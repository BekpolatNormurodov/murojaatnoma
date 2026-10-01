import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  // Real citizen murojaats (Application) are served through /requests too.
  imports: [ApplicationsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
