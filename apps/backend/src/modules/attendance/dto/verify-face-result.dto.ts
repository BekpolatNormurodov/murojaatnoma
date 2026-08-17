import { ApiProperty } from '@nestjs/swagger';

export class VerifyFaceResultDto {
  @ApiProperty({
    description: 'Whether the best match score meets the configured face-match threshold',
  })
  matched!: boolean;

  @ApiProperty({
    description:
      "Best cosine-similarity score against the employee's enrolled templates (0..1)",
  })
  score!: number;

  @ApiProperty({ description: 'Configured face-match threshold used for the comparison' })
  threshold!: number;
}
