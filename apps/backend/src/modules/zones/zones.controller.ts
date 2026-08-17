import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ZoneKind } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { LocateQueryDto } from './dto/locate-query.dto';
import { ZonesService } from './zones.service';

/**
 * Public read-only access to administrative zones (hudud): the Mirzo Ulug'bek
 * district boundary + its 70 mahallas. Map clients (web-admin, worker-app)
 * fetch GeoJSON here; the geofence pipeline uses /locate.
 */
@ApiTags('zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  private parseKind(kind?: string): ZoneKind | undefined {
    if (!kind) {
      return undefined;
    }
    const upper = kind.toUpperCase();
    if (upper === ZoneKind.DISTRICT || upper === ZoneKind.MAHALLA) {
      return upper as ZoneKind;
    }
    throw new BadRequestException(`Unknown zone kind "${kind}" (use district|mahalla)`);
  }

  // Zones are effectively immutable reference data (seeded from static GIS
  // files). Let map clients cache them so every page load doesn't re-download
  // ~290KB of mahalla polygons; a 1-hour window still picks up a re-seed soon.
  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Zone metadata (no geometry)' })
  @ApiQuery({ name: 'kind', required: false, enum: ['district', 'mahalla'] })
  listZones(@Query('kind') kind?: string) {
    return this.zonesService.listZones(this.parseKind(kind));
  }

  @Public()
  @Get('geojson')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Zones as a GeoJSON FeatureCollection (for maps)' })
  @ApiQuery({ name: 'kind', required: false, enum: ['district', 'mahalla'] })
  geojson(@Query('kind') kind?: string) {
    return this.zonesService.getGeoJson(this.parseKind(kind));
  }

  @Public()
  @Get('locate')
  @ApiOperation({ summary: 'Which mahalla (and inside-district) is a lat/lng point?' })
  locate(@Query() query: LocateQueryDto) {
    return this.zonesService.locate(query.lat, query.lng);
  }
}
