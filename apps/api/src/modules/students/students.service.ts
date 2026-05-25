import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQuery } from './dto/list-students.query';

@Injectable()
export class StudentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventService: EventService,
  ) {}

  async create(dto: CreateStudentDto, user: User): Promise<Student> {
    return this.dataSource.transaction(async (manager) => {
      const student = await manager.save(Student, manager.create(Student, { ...dto, isActive: true }));
      await this.eventService.record(manager, {
        action: 'student.created',
        entity: 'student',
        entityId: student.id,
        userId: user.id,
        dto: { fullName: dto.fullName },
      });
      return student;
    });
  }

  async findAll(query: ListStudentsQuery): Promise<{ data: Student[]; total: number }> {
    const qb = this.dataSource.getRepository(Student).createQueryBuilder('s');

    if (query.search) {
      qb.andWhere('s.full_name ILIKE :search', { search: `%${query.search}%` });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('s.is_active = :isActive', { isActive: query.isActive === 'true' });
    }

    const [data, total] = await qb
      .orderBy('s.full_name', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.dataSource.getRepository(Student).findOneBy({ id });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, user: User): Promise<Student> {
    return this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(Student, { where: { id } });
      if (!student) throw new NotFoundException(`Student ${id} not found`);
      const saved = await manager.save(Student, { ...student, ...dto });
      await this.eventService.record(manager, {
        action: 'student.updated',
        entity: 'student',
        entityId: id,
        userId: user.id,
        dto: dto as Record<string, unknown>,
      });
      return saved;
    });
  }

  async archive(id: string, user: User): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(Student, { where: { id } });
      if (!student) throw new NotFoundException(`Student ${id} not found`);
      await manager.save(Student, { ...student, isActive: false });
      await this.eventService.record(manager, {
        action: 'student.archived',
        entity: 'student',
        entityId: id,
        userId: user.id,
        dto: {},
      });
    });
  }
}
