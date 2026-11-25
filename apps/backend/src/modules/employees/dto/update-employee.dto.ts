import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

// `assignedMahallaCodes` is declared again below: PartialType makes every
// inherited field skip validation for `null`, and `null` is not a territory.
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['assignedMahallaCodes'] as const),
) {
  @ApiPropertyOptional({
    type: [String],
    description: 'Omitted = unchanged; [] = the whole district; null is refused.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  assignedMahallaCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
