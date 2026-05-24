import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ContractsService } from './contracts.service';
import { SignContractDto } from './dto/sign-contract.dto';

@ApiTags('contracts-public')
@Public()
@Controller('public/contracts')
export class PublicContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.contractsService.view(token);
  }

  @Post(':token/sign')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  sign(@Param('token') token: string, @Body() dto: SignContractDto, @Req() req: Request) {
    return this.contractsService.sign(token, dto.signatureImage, req);
  }

  @Get(':token/pdf')
  async downloadSignedPdf(@Param('token') token: string, @Res() res: Response) {
    const { stream, filename } = await this.contractsService.downloadSignedPdfStream(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }
}
