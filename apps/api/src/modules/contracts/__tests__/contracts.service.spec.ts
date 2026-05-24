import { ConflictException, GoneException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { ContractsService } from '../contracts.service';
import { ContractTemplate } from '../entities/contract-template.entity';
import { PlanContract } from '../entities/plan-contract.entity';
import { MarkdownRendererService } from '../markdown-renderer.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import { EventService } from '../../../event/event.service';
import { VariableResolverService } from '../variable-resolver.service';
import type { ContractStorageProvider } from '../storage/contract-storage.interface';
import type { User } from '../../../user/user.entity';

type AnyFn = (...args: unknown[]) => unknown;

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (e: unknown) => e),
    create: jest.fn((_: unknown, data: unknown) => ({ ...(data as object) })),
    remove: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

function makeDataSource(manager: EntityManager): DataSource {
  return {
    transaction: jest.fn(async (fn: (m: EntityManager) => Promise<unknown>) => fn(manager)),
    getRepository: jest.fn(() => ({ findOne: manager.findOne, find: manager.find }) as unknown),
    query: jest.fn(),
  } as unknown as DataSource;
}

const mockUser: User = {
  id: 'user-1',
  email: 'owner@studio.com',
  role: 'operator',
  isActive: true,
  studentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  firebaseUid: 'uid',
};

const mockTemplate: ContractTemplate = {
  id: 'tpl-1',
  name: 'Contrato Padrão',
  bodyMarkdown: '# Contrato\n\nOlá {{studentName}}',
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockContract: PlanContract = {
  id: 'contract-1',
  planId: 'plan-1',
  templateId: 'tpl-1',
  templateVersion: 1,
  bodyMarkdown: '# Contrato\n\nOlá {{studentName}}',
  resolvedVariables: null,
  renderedHtml: null,
  contentHash: null,
  status: 'draft',
  accessToken: null,
  sentAt: null,
  signedAt: null,
  cancelledAt: null,
  signatureImage: null,
  signedPdfPath: null,
  signerIp: null,
  signerUserAgent: null,
  signerGeoCity: null,
  signerGeoRegion: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeService(managerOverrides: Record<string, AnyFn> = {}) {
  const manager = makeManager({
    findOne: jest.fn(async (Entity: unknown) => {
      if (Entity === ContractTemplate) return { ...mockTemplate };
      if (Entity === PlanContract) return null;
      return null;
    }) as AnyFn,
    save: jest.fn(async (e: unknown) => e) as AnyFn,
    create: jest.fn((_: unknown, data: unknown) => ({ ...(data as object) })) as AnyFn,
    ...managerOverrides,
  });
  const ds = makeDataSource(manager);

  const eventService = { record: jest.fn() } as unknown as EventService;
  const variableResolver = {
    resolve: jest.fn().mockResolvedValue({ studentName: 'Maria' }),
    dummyVars: jest.fn().mockReturnValue({ studentName: 'Maria' }),
  } as unknown as VariableResolverService;
  const markdownRenderer = { toHtml: jest.fn().mockReturnValue('<p>Olá Maria</p>') } as unknown as MarkdownRendererService;
  const pdfGenerator = { generate: jest.fn().mockResolvedValue(Buffer.from('pdf')) } as unknown as PdfGeneratorService;
  const storage: ContractStorageProvider = {
    save: jest.fn().mockResolvedValue('contracts/contract-1.pdf'),
    read: jest.fn(),
    createReadStream: jest.fn(),
    delete: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue('http://localhost:5173') } as unknown as ConfigService;

  const service = new ContractsService(ds, eventService, variableResolver, markdownRenderer, pdfGenerator, storage, config);
  return { service, manager, ds, eventService, variableResolver, markdownRenderer, pdfGenerator, storage };
}

describe('ContractsService', () => {
  describe('createTemplate()', () => {
    it('creates template and records event', async () => {
      const { service, eventService } = makeService({
        create: jest.fn(() => ({ ...mockTemplate })) as AnyFn,
        save: jest.fn(async (e: unknown) => ({ ...(e as object), id: 'tpl-new' })) as AnyFn,
      });
      const result = await service.createTemplate({ name: 'Test', bodyMarkdown: '# Test' }, mockUser);
      expect(result.id).toBe('tpl-new');
      expect(eventService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'contract_template.created' }),
      );
    });
  });

  describe('updateTemplate()', () => {
    it('increments version', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ ...mockTemplate, version: 2 }) as AnyFn,
        save: jest.fn(async (e: unknown) => e) as AnyFn,
      });
      const result = await service.updateTemplate('tpl-1', { name: 'Updated' }, mockUser);
      expect(result.version).toBe(3);
    });

    it('throws NotFoundException for missing template', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue(null) as AnyFn,
      });
      await expect(service.updateTemplate('bad-id', {}, mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveTemplate()', () => {
    it('sets isActive=false', async () => {
      let saved: unknown = null;
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ ...mockTemplate }) as AnyFn,
        save: jest.fn(async (e: unknown) => { saved = e; return e; }) as AnyFn,
      });
      await service.archiveTemplate('tpl-1', mockUser);
      expect((saved as ContractTemplate)?.isActive).toBe(false);
    });
  });

  describe('materialize()', () => {
    it('creates draft contract', async () => {
      const { service } = makeService({
        findOne: jest.fn(async (Entity: unknown) => {
          if (Entity === PlanContract) return null;
          if (Entity === ContractTemplate) return { ...mockTemplate };
          return null;
        }) as AnyFn,
        create: jest.fn((_: unknown, data: unknown) => ({ ...(data as object), id: 'contract-new', createdAt: new Date(), updatedAt: new Date() })) as AnyFn,
        save: jest.fn(async (e: unknown) => ({ ...(e as object) })) as AnyFn,
      });
      const result = await service.materialize('plan-1', { templateId: 'tpl-1' }, mockUser);
      expect(result.status).toBe('draft');
    });

    it('throws 409 if plan already has non-cancelled contract', async () => {
      const { service } = makeService({
        findOne: jest.fn(async (Entity: unknown) => {
          if (Entity === PlanContract) return { ...mockContract, status: 'sent' };
          return null;
        }) as AnyFn,
      });
      await expect(service.materialize('plan-1', { templateId: 'tpl-1' }, mockUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateDraft()', () => {
    it('throws 409 if not in draft status', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ ...mockContract, status: 'sent' }) as AnyFn,
      });
      await expect(service.updateDraft('plan-1', { bodyMarkdown: 'new' }, mockUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('send()', () => {
    it('transitions to sent with accessToken', async () => {
      let saved: unknown = null;
      const { service } = makeService({
        findOne: jest.fn(async (Entity: unknown) => {
          if (Entity === PlanContract) return { ...mockContract };
          if (Entity === ContractTemplate) return { ...mockTemplate };
          return null;
        }) as AnyFn,
        save: jest.fn(async (e: unknown) => { saved = e; return e; }) as AnyFn,
      });
      const result = await service.send('plan-1', mockUser);
      expect(result.publicUrl).toContain('/contrato/');
      expect((saved as PlanContract)?.status).toBe('sent');
      expect((saved as PlanContract)?.accessToken).toBeTruthy();
    });

    it('throws 422 if template has unresolved variables', async () => {
      const { service, variableResolver } = makeService({
        findOne: jest.fn(async (Entity: unknown) => {
          if (Entity === PlanContract) return { ...mockContract, bodyMarkdown: '{{naoExiste}}' };
          return { ...mockTemplate };
        }) as AnyFn,
      });
      (variableResolver.resolve as jest.Mock).mockResolvedValue({});
      await expect(service.send('plan-1', mockUser)).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('cancel()', () => {
    it('throws 409 if contract is signed', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ ...mockContract, status: 'signed' }) as AnyFn,
      });
      await expect(service.cancel('plan-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('cancels a sent contract', async () => {
      let saved: unknown = null;
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ ...mockContract, status: 'sent' }) as AnyFn,
        save: jest.fn(async (e: unknown) => { saved = e; return e; }) as AnyFn,
      });
      await service.cancel('plan-1', mockUser);
      expect((saved as PlanContract)?.status).toBe('cancelled');
    });
  });

  describe('view()', () => {
    it('throws 410 if signed and more than 7 days ago', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const { service, ds } = makeService();
      (ds.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue({
          ...mockContract,
          status: 'signed',
          signedAt: eightDaysAgo,
          accessToken: 'tok',
        }),
      });
      await expect(service.view('tok')).rejects.toThrow(GoneException);
    });

    it('throws 404 for invalid token', async () => {
      const { service, ds } = makeService();
      (ds.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });
      await expect(service.view('bad-token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sign()', () => {
    it('generates PDF, stores it, transitions to signed', async () => {
      const sentContract = {
        ...mockContract,
        status: 'sent' as const,
        renderedHtml: '<p>Hi</p>',
        accessToken: 'tok',
      };
      let saved: unknown = null;
      const { service, pdfGenerator, storage } = makeService({
        findOne: jest.fn().mockResolvedValue(sentContract) as AnyFn,
        save: jest.fn(async (e: unknown) => { saved = e; return e; }) as AnyFn,
      });
      const fakeSignature = 'data:image/png;base64,' + 'A'.repeat(1400);
      const mockReq = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as import('express').Request;
      await service.sign('tok', fakeSignature, mockReq);
      expect(pdfGenerator.generate).toHaveBeenCalled();
      expect(storage.save).toHaveBeenCalled();
      expect((saved as PlanContract)?.status).toBe('signed');
      expect((saved as PlanContract)?.contentHash).toBeTruthy();
    });
  });
});
