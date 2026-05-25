import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../../user/user.entity';

interface PlanWithRelations {
  id: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  weeklyFrequency: number;
  period: string;
  paymentMethod: string | null;
  student: {
    name: string;
    email: string | null;
    phone: string | null;
    cpf: string | null;
    rg: string | null;
    addressStreet: string | null;
    addressNumber: string | null;
    addressComplement: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZipcode: string | null;
  };
  planCatalog: { name: string } | null;
  receivables?: Array<{ amount: string }>;
}

@Injectable()
export class VariableResolverService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async resolve(planId: string, currentUser: User): Promise<Record<string, string>> {
    const plan = await this.loadPlan(planId);
    return this.buildVars(plan, currentUser);
  }

  async resolveFromPlan(plan: PlanWithRelations, currentUser: User): Promise<Record<string, string>> {
    return this.buildVars(plan, currentUser);
  }

  private async loadPlan(planId: string): Promise<PlanWithRelations> {
    const result = await this.dataSource.query(
      `SELECT
        p.id, p.start_date AS "startDate", p.end_date AS "endDate",
        p.total_price AS "totalPrice", p.weekly_frequency AS "weeklyFrequency",
        p.period, p.payment_method AS "paymentMethod",
        s.full_name AS "studentName", s.email AS "studentEmail",
        s.phone AS "studentPhone",
        s.cpf AS "studentCpf", s.rg AS "studentRg",
        s.address_street AS "studentAddressStreet",
        s.address_number AS "studentAddressNumber",
        s.address_complement AS "studentAddressComplement",
        s.address_city AS "studentAddressCity",
        s.address_state AS "studentAddressState",
        s.address_zipcode AS "studentAddressZipcode",
        pc.name AS "planCatalogName"
       FROM plan p
       JOIN student s ON s.id = p.student_id
       LEFT JOIN plan_catalog pc ON pc.id = p.plan_catalog_id
       WHERE p.id = $1`,
      [planId],
    );

    if (!result.length) throw new Error(`Plan ${planId} not found`);
    const row = result[0] as {
      id: string;
      startDate: string;
      endDate: string;
      totalPrice: string;
      weeklyFrequency: number;
      period: string;
      paymentMethod: string | null;
      studentName: string;
      studentEmail: string | null;
      studentPhone: string | null;
      studentCpf: string | null;
      studentRg: string | null;
      studentAddressStreet: string | null;
      studentAddressNumber: string | null;
      studentAddressComplement: string | null;
      studentAddressCity: string | null;
      studentAddressState: string | null;
      studentAddressZipcode: string | null;
      planCatalogName: string | null;
    };

    const receivables = await this.dataSource.query(
      `SELECT amount FROM receivable WHERE plan_id = $1 ORDER BY due_date ASC`,
      [planId],
    );

    return {
      id: row.id,
      startDate: row.startDate,
      endDate: row.endDate,
      totalPrice: row.totalPrice,
      weeklyFrequency: row.weeklyFrequency,
      period: row.period,
      paymentMethod: row.paymentMethod,
      student: {
        name: row.studentName,
        email: row.studentEmail,
        phone: row.studentPhone,
        cpf: row.studentCpf,
        rg: row.studentRg,
        addressStreet: row.studentAddressStreet,
        addressNumber: row.studentAddressNumber,
        addressComplement: row.studentAddressComplement,
        addressCity: row.studentAddressCity,
        addressState: row.studentAddressState,
        addressZipcode: row.studentAddressZipcode,
      },
      planCatalog: row.planCatalogName ? { name: row.planCatalogName } : null,
      receivables: receivables as Array<{ amount: string }>,
    };
  }

  private formatAddress(s: PlanWithRelations['student']): string {
    const parts: string[] = [];
    if (s.addressStreet) {
      const line = s.addressNumber ? `${s.addressStreet}, ${s.addressNumber}` : s.addressStreet;
      parts.push(s.addressComplement ? `${line}, ${s.addressComplement}` : line);
    }
    const cityState = [s.addressCity, s.addressState].filter(Boolean).join('/');
    if (cityState) parts.push(cityState);
    if (s.addressZipcode) parts.push(`CEP ${s.addressZipcode}`);
    return parts.join(' - ');
  }

  private buildVars(plan: PlanWithRelations, currentUser: User): Record<string, string> {
    const studioName = this.config.get<string>('STUDIO_NAME') ?? 'Studio';
    const todayDate = this.formatDate(new Date());

    const receivables: Array<{ amount: string }> = plan.receivables ?? [];
    const installmentsCount = receivables.length;
    const installmentValue = receivables.length > 0
      ? this.formatBrl(receivables[0].amount)
      : this.formatBrl(plan.totalPrice);

    return {
      studentName: plan.student.name,
      studentEmail: plan.student.email ?? '',
      studentPhone: plan.student.phone ?? '',
      studentCpf: plan.student.cpf ?? '',
      studentRg: plan.student.rg ?? '',
      studentAddress: this.formatAddress(plan.student),
      studentAddressCity: plan.student.addressCity ?? '',
      studentAddressState: plan.student.addressState ?? '',
      planName: plan.planCatalog?.name ?? '',
      weeklyFrequency: String(plan.weeklyFrequency),
      period: plan.period,
      startDate: this.formatDate(new Date(plan.startDate)),
      endDate: this.formatDate(new Date(plan.endDate)),
      totalPrice: this.formatBrl(plan.totalPrice),
      installmentsCount: String(installmentsCount),
      installmentValue,
      paymentMethod: plan.paymentMethod ?? '',
      studioOwnerName: currentUser.email,
      studioName,
      todayDate,
    };
  }

  private formatDate(date: Date): string {
    const d = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return d;
  }

  private formatBrl(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  dummyVars(currentUser: User): Record<string, string> {
    const studioName = this.config.get<string>('STUDIO_NAME') ?? 'Studio';
    return {
      studentName: 'Maria Silva',
      studentEmail: 'maria@exemplo.com',
      studentPhone: '(11) 99999-9999',
      studentCpf: '123.456.789-00',
      studentRg: '12.345.678-9',
      studentAddress: 'Rua das Flores, 100, Apto 1 - São Paulo/SP - CEP 01310-100',
      studentAddressCity: 'São Paulo',
      studentAddressState: 'SP',
      planName: 'Plano Mensal',
      weeklyFrequency: '2',
      period: 'monthly',
      startDate: '01/01/2026',
      endDate: '31/01/2026',
      totalPrice: 'R$ 480,00',
      installmentsCount: '1',
      installmentValue: 'R$ 480,00',
      paymentMethod: 'pix',
      studioOwnerName: currentUser.email,
      studioName,
      todayDate: this.formatDate(new Date()),
    };
  }
}
