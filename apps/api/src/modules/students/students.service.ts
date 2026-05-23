import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQuery } from './dto/list-students.query';

@Injectable()
export class StudentsService {
  constructor(@InjectRepository(Student) private readonly repo: Repository<Student>) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    return this.repo.save(this.repo.create({ ...dto, isActive: true }));
  }

  async findAll(query: ListStudentsQuery): Promise<{ data: Student[]; total: number }> {
    const qb = this.repo.createQueryBuilder('s');

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
    const student = await this.repo.findOneBy({ id });
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.findOne(id);
    return this.repo.save({ ...student, ...dto });
  }

  async archive(id: string): Promise<void> {
    const student = await this.findOne(id);
    await this.repo.save({ ...student, isActive: false });
  }
}
