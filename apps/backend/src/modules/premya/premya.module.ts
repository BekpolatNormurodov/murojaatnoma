import { Module } from '@nestjs/common';
import { PremyaController } from './premya.controller';
import { PremyaService } from './premya.service';

@Module({
  controllers: [PremyaController],
  providers: [PremyaService],
})
export class PremyaModule {}
