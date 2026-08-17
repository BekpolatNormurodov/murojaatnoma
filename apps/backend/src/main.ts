import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/configuration';
import {
  flattenValidationErrors,
  ValidationExceptionPayload,
} from './common/i18n/validation-exception.types';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);
  const { port } = configService.get('app', { infer: true });

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Preserve the structured, per-field class-validator errors (property
      // + constraint key -> English message) instead of flattening them to
      // English strings here. AllExceptionsFilter localizes this payload
      // into the caller's language (uz default, ru via Accept-Language /
      // X-Lang) before it reaches the client — see
      // src/common/filters/all-exceptions.filter.ts and
      // src/common/i18n/validation-messages.ts.
      exceptionFactory: (errors: ValidationError[]) => {
        const payload: ValidationExceptionPayload = {
          message: 'Validation failed',
          isValidationException: true,
          validationErrors: flattenValidationErrors(errors),
        };
        return new BadRequestException(payload);
      },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hokimiyat tizimi API')
    .setDescription(
      'Backend API for the government employee-management ecosystem: auth, employees (Xodim), attendance (Davomat), citizen applications (Murojaat/Ariza), and notifications.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(port);
  Logger.log(`Application listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
