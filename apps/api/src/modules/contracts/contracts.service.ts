import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { differenceInDays } from 'date-fns';
import { Request } from 'express';
import * as geoip from 'geoip-lite';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { ListContractTemplatesQuery } from './dto/list-contract-templates.query';
import { MaterializePlanContractDto } from './dto/materialize-plan-contract.dto';
import { PreviewContractTemplateDto } from './dto/preview-contract-template.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdatePlanContractDto } from './dto/update-plan-contract.dto';
import { ContractTemplate } from './entities/contract-template.entity';
import { PlanContract } from './entities/plan-contract.entity';
import { MarkdownRendererService } from './markdown-renderer.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { CONTRACT_STORAGE, ContractStorageProvider } from './storage/contract-storage.interface';
import { VariableResolverService } from './variable-resolver.service';

const PUBLIC_ACCESS_WINDOW_DAYS = 7;

function interpolate(markdown: string, vars: Record<string, string>): string {
  return markdown.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function findMissingVariables(markdown: string, vars: Record<string, string>): string[] {
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  const re = /{{\s*(\w+)\s*}}/g;
  while ((m = re.exec(markdown)) !== null) {
    const key = m[1];
    if (!(key in vars) && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.socket.remoteAddress ?? '0.0.0.0';
}

function validateSignaturePng(base64: string): void {
  const data = base64.replace(/^data:image\/png;base64,/, '');
  if (Buffer.from(data, 'base64').length < 1000) {
    throw new UnprocessableEntityException('Signature image is too small or empty');
  }
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventService: EventService,
    private readonly variableResolver: VariableResolverService,
    private readonly markdownRenderer: MarkdownRendererService,
    private readonly pdfGenerator: PdfGeneratorService,
    @Inject(CONTRACT_STORAGE) private readonly storage: ContractStorageProvider,
    private readonly config: ConfigService,
  ) {}

  // ─── Templates ───────────────────────────────────────────────────────────────

  async listTemplates(query: ListContractTemplatesQuery) {
    const repo = this.dataSource.getRepository(ContractTemplate);
    const where: Partial<ContractTemplate> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const templates = await repo.find({ where, order: { createdAt: 'DESC' } });
    return templates.map(templateToResponse);
  }

  async createTemplate(dto: CreateContractTemplateDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const tpl = manager.create(ContractTemplate, {
        name: dto.name,
        bodyMarkdown: dto.bodyMarkdown,
        version: 1,
        isActive: true,
      });
      const saved = await manager.save(tpl);
      await this.eventService.record(manager, {
        action: 'contract_template.created',
        entity: 'contract_template',
        entityId: saved.id,
        userId: user.id,
        dto: { name: dto.name },
      });
      return templateToResponse(saved);
    });
  }

  async getTemplate(id: string) {
    const tpl = await this.dataSource.getRepository(ContractTemplate).findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Contract template not found');
    return templateToResponse(tpl);
  }

  async updateTemplate(id: string, dto: UpdateContractTemplateDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const tpl = await manager.findOne(ContractTemplate, { where: { id } });
      if (!tpl) throw new NotFoundException('Contract template not found');

      if (dto.name !== undefined) tpl.name = dto.name;
      if (dto.bodyMarkdown !== undefined) tpl.bodyMarkdown = dto.bodyMarkdown;
      if (dto.isActive !== undefined) tpl.isActive = dto.isActive;
      tpl.version = tpl.version + 1;

      const saved = await manager.save(tpl);
      await this.eventService.record(manager, {
        action: 'contract_template.updated',
        entity: 'contract_template',
        entityId: saved.id,
        userId: user.id,
        dto: { ...dto, version: saved.version },
      });
      return templateToResponse(saved);
    });
  }

  async archiveTemplate(id: string, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const tpl = await manager.findOne(ContractTemplate, { where: { id } });
      if (!tpl) throw new NotFoundException('Contract template not found');
      tpl.isActive = false;
      tpl.version = tpl.version + 1;
      await manager.save(tpl);
      await this.eventService.record(manager, {
        action: 'contract_template.archived',
        entity: 'contract_template',
        entityId: id,
        userId: user.id,
        dto: {},
      });
    });
  }

  async previewTemplate(id: string, dto: PreviewContractTemplateDto, user: User) {
    const tpl = await this.dataSource.getRepository(ContractTemplate).findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Contract template not found');

    let vars: Record<string, string>;
    if (dto.planId) {
      vars = await this.variableResolver.resolve(dto.planId, user);
    } else {
      vars = this.variableResolver.dummyVars(user);
    }

    const missingVariables = findMissingVariables(tpl.bodyMarkdown, vars);
    const interpolated = interpolate(tpl.bodyMarkdown, vars);
    const renderedHtml = this.markdownRenderer.toHtml(interpolated);

    return { renderedHtml, resolvedVariables: vars, missingVariables };
  }

  // ─── Plan Contracts ───────────────────────────────────────────────────────────

  async materialize(planId: string, dto: MaterializePlanContractDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      // Check if plan already has a non-cancelled contract
      const existing = await manager.findOne(PlanContract, { where: { planId } });
      if (existing && existing.status !== 'cancelled') {
        throw new ConflictException('Plan already has an active contract. Cancel it first.');
      }

      const tpl = await manager.findOne(ContractTemplate, { where: { id: dto.templateId } });
      if (!tpl) throw new NotFoundException('Contract template not found');
      if (!tpl.isActive) throw new ConflictException('Contract template is archived');

      // Delete cancelled contract if present (allow re-creation on same plan)
      if (existing) await manager.remove(existing);

      const contract = manager.create(PlanContract, {
        planId,
        templateId: tpl.id,
        templateVersion: tpl.version,
        bodyMarkdown: tpl.bodyMarkdown,
        status: 'draft',
      });
      const saved = await manager.save(contract);
      await this.eventService.record(manager, {
        action: 'plan_contract.materialized',
        entity: 'plan_contract',
        entityId: saved.id,
        userId: user.id,
        dto: { planId, templateId: dto.templateId },
      });
      return contractToDetail(saved, null);
    });
  }

  async getByPlan(planId: string, _user: User) {
    const contract = await this.dataSource.getRepository(PlanContract).findOne({ where: { planId } });
    if (!contract) throw new NotFoundException('No contract found for this plan');
    const publicUrl = contract.accessToken ? this.buildPublicUrl(contract.accessToken) : null;
    return contractToDetail(contract, publicUrl);
  }

  async updateDraft(planId: string, dto: UpdatePlanContractDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(PlanContract, { where: { planId } });
      if (!contract) throw new NotFoundException('No contract found for this plan');
      if (contract.status !== 'draft') throw new ConflictException('Contract can only be edited in draft status');

      contract.bodyMarkdown = dto.bodyMarkdown;
      const saved = await manager.save(contract);
      await this.eventService.record(manager, {
        action: 'plan_contract.updated',
        entity: 'plan_contract',
        entityId: saved.id,
        userId: user.id,
        dto: {},
      });
      return contractToDetail(saved, null);
    });
  }

  async send(planId: string, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(PlanContract, { where: { planId } });
      if (!contract) throw new NotFoundException('No contract found for this plan');
      if (contract.status !== 'draft') throw new ConflictException('Contract is not in draft status');

      const vars = await this.variableResolver.resolve(planId, user);
      const missing = findMissingVariables(contract.bodyMarkdown, vars);
      if (missing.length) throw new UnprocessableEntityException({ missingVariables: missing });

      const tpl = await manager.findOne(ContractTemplate, { where: { id: contract.templateId } });

      const interpolated = interpolate(contract.bodyMarkdown, vars);
      contract.renderedHtml = this.markdownRenderer.toHtml(interpolated);
      contract.resolvedVariables = vars;
      contract.accessToken = randomBytes(32).toString('hex');
      contract.templateVersion = tpl?.version ?? contract.templateVersion;
      contract.status = 'sent';
      contract.sentAt = new Date();

      await manager.save(contract);
      await this.eventService.record(manager, {
        action: 'plan_contract.sent',
        entity: 'plan_contract',
        entityId: contract.id,
        userId: user.id,
        dto: { planId },
      });

      return { publicUrl: this.buildPublicUrl(contract.accessToken) };
    });
  }

  async cancel(planId: string, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(PlanContract, { where: { planId } });
      if (!contract) throw new NotFoundException('No contract found for this plan');
      if (contract.status === 'signed') throw new ConflictException('Signed contracts cannot be cancelled');
      if (contract.status === 'cancelled') throw new ConflictException('Contract is already cancelled');

      contract.status = 'cancelled';
      contract.cancelledAt = new Date();
      await manager.save(contract);
      await this.eventService.record(manager, {
        action: 'plan_contract.cancelled',
        entity: 'plan_contract',
        entityId: contract.id,
        userId: user.id,
        dto: { planId },
      });
    });
  }

  async downloadPdf(planId: string, _user: User): Promise<{ buffer: Buffer; filename: string }> {
    const contract = await this.dataSource.getRepository(PlanContract).findOne({ where: { planId } });
    if (!contract) throw new NotFoundException('No contract found for this plan');

    if (contract.status === 'signed' && contract.signedPdfPath) {
      const buffer = await this.storage.read(contract.signedPdfPath);
      const name = `contrato-${planId}.pdf`;
      return { buffer, filename: name };
    }

    // Preview PDF
    const buffer = await this.pdfGenerator.generate(contract);
    return { buffer, filename: `contrato-preview-${planId}.pdf` };
  }

  async getSignatureLink(planId: string) {
    const contract = await this.dataSource.getRepository(PlanContract).findOne({ where: { planId } });
    if (!contract) throw new NotFoundException('No contract found for this plan');
    if (contract.status !== 'sent' && contract.status !== 'signed') {
      throw new ConflictException('Contract is not in sent or signed status');
    }
    if (!contract.accessToken) throw new ConflictException('Contract has no public link');
    return { publicUrl: this.buildPublicUrl(contract.accessToken) };
  }

  // ─── Public ──────────────────────────────────────────────────────────────────

  async view(token: string) {
    const contract = await this.dataSource.getRepository(PlanContract).findOne({ where: { accessToken: token } });
    if (!contract) throw new NotFoundException('Invalid or expired contract link');

    if (contract.status === 'signed' && contract.signedAt) {
      if (differenceInDays(new Date(), contract.signedAt) > PUBLIC_ACCESS_WINDOW_DAYS) {
        throw new GoneException('This link has expired');
      }
    }

    if (contract.status === 'cancelled') throw new GoneException('This contract has been cancelled');

    // Get student name from plan
    const rows = await this.dataSource.query(
      `SELECT s.full_name AS "studentName" FROM plan p JOIN student s ON s.id = p.student_id WHERE p.id = $1`,
      [contract.planId],
    );
    const studentName: string = rows[0]?.studentName ?? '';
    const studioName = this.config.get<string>('STUDIO_NAME') ?? 'Studio';
    const pdfAvailable = contract.status === 'signed';

    return {
      renderedHtml: contract.renderedHtml ?? '',
      status: contract.status,
      signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
      pdfAvailable,
      studentName,
      studioName,
    };
  }

  async sign(token: string, signatureImage: string, req: Request) {
    validateSignaturePng(signatureImage);

    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(PlanContract, { where: { accessToken: token } });
      if (!contract) throw new NotFoundException('Invalid or expired contract link');
      if (contract.status !== 'sent') throw new ConflictException('Contract is not awaiting signature');

      const ip = extractIp(req);
      const ua = ((req.headers['user-agent'] as string) ?? '').slice(0, 500);
      const geo = geoip.lookup(ip);

      contract.signatureImage = signatureImage;
      contract.signerIp = ip;
      contract.signerUserAgent = ua;
      contract.signerGeoCity = geo?.city ?? null;
      contract.signerGeoRegion = geo?.region ?? null;
      contract.contentHash = sha256(contract.renderedHtml ?? '');
      contract.signedAt = new Date();
      contract.status = 'signed';

      const pdfBuffer = await this.pdfGenerator.generate(contract);
      contract.signedPdfPath = await this.storage.save(
        `contracts/${contract.id}.pdf`,
        pdfBuffer,
        'application/pdf',
      );

      await manager.save(contract);
      await this.eventService.record(manager, {
        action: 'plan_contract.signed',
        entity: 'plan_contract',
        entityId: contract.id,
        userId: null as unknown as string,
        dto: {
          ip,
          ua,
          geoCity: geo?.city ?? null,
          geoRegion: geo?.region ?? null,
          contentHash: contract.contentHash,
        },
      });

      return { pdfUrl: `/api/v1/public/contracts/${token}/pdf` };
    });
  }

  downloadSignedPdfStream(token: string): Promise<{ stream: NodeJS.ReadableStream; filename: string }> {
    return this.dataSource.getRepository(PlanContract)
      .findOne({ where: { accessToken: token } })
      .then((contract) => {
        if (!contract) throw new NotFoundException('Invalid or expired contract link');
        if (contract.status !== 'signed') throw new ConflictException('Contract is not signed yet');
        if (!contract.signedPdfPath) throw new NotFoundException('Signed PDF not found');

        if (contract.signedAt && differenceInDays(new Date(), contract.signedAt) > PUBLIC_ACCESS_WINDOW_DAYS) {
          throw new GoneException('This link has expired');
        }

        return {
          stream: this.storage.createReadStream(contract.signedPdfPath),
          filename: `contrato-${contract.id}.pdf`,
        };
      });
  }

  private buildPublicUrl(token: string): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return `${frontendUrl}/contrato/${token}`;
  }
}

function templateToResponse(tpl: ContractTemplate) {
  return {
    id: tpl.id,
    name: tpl.name,
    bodyMarkdown: tpl.bodyMarkdown,
    version: tpl.version,
    isActive: tpl.isActive,
    createdAt: tpl.createdAt.toISOString(),
    updatedAt: tpl.updatedAt.toISOString(),
  };
}

function contractToDetail(c: PlanContract, publicUrl: string | null) {
  return {
    id: c.id,
    planId: c.planId,
    templateId: c.templateId,
    templateVersion: c.templateVersion,
    status: c.status,
    bodyMarkdown: c.bodyMarkdown,
    renderedHtml: c.renderedHtml,
    resolvedVariables: c.resolvedVariables,
    signatureImage: c.signatureImage,
    signerIp: c.signerIp,
    signerUserAgent: c.signerUserAgent,
    signerGeoCity: c.signerGeoCity,
    signerGeoRegion: c.signerGeoRegion,
    contentHash: c.contentHash,
    sentAt: c.sentAt?.toISOString() ?? null,
    signedAt: c.signedAt?.toISOString() ?? null,
    cancelledAt: c.cancelledAt?.toISOString() ?? null,
    publicUrl,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
