import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetadata {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 100 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items', isArray: true })
  items: T[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetadata })
  pagination: PaginationMetadata;

  constructor(items: T[], page: number, limit: number, total: number) {
    this.items = items;
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
