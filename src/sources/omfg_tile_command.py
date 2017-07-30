import math
import os.path
import datetime
from maperipy import *
from maperipy.tilegen import TileGenCommand
from maperipy.osm import *
from maperipy.webmaps import *

available_tiles = []
min_zoom_value = 10
EARTHDATA_AUTH_TOKEN = 'WXIthpg9BGcAABQawIwAAACx'

def modification_date(filename):
    t = os.path.getmtime(filename)
    return datetime.datetime.fromtimestamp(t)


def coords2tile(coords, zoom):
    lat_deg = coords[0]
    lon_deg = coords[1]
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return xtile, ytile


def tile2coords(tile):
    x = tile[0]
    y = tile[1]
    zoom = tile[2]
    n = 2.0 ** zoom
    lon_deg = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat_deg = math.degrees(lat_rad)
    return lon_deg, lat_deg


def tile2bounds(tile):
    x = tile[0]
    y = tile[1]
    zoom = tile[2]
    nw = tile2coords(tile)
    se = tile2coords((x + 1, y + 1, zoom))
    return Map.create_bbox(nw[0], nw[1], se[0], se[1])


def tile2middle_bounds(tile):
    x = tile[0]
    y = tile[1]
    zoom = tile[2]
    coords = tile2coords((x + 0.5, y + 0.5, zoom))
    return Map.create_bbox(coords[0], coords[1], coords[0], coords[1])


def get_parent_tile(tile, parent_zoom):
    x = tile[0]
    y = tile[1]
    zoom = tile[2]
    if zoom < parent_zoom:
        App.log('parent_zoom %s is larger than tile zoom %s' % (parent_zoom, zoom))
        return None
    diff = zoom - parent_zoom
    power = 2 ** diff
    parent_x = x / power
    parent_y = y / power
    return [parent_x, parent_y, parent_zoom]


def set_map_bounds(bounds):
    Map.zoom_area(bounds)
    App.run_command('set-geo-bounds %s' % bounds)


def use_rules_set(rules_file_name):
    App.run_command('use-ruleset location="%s"' % rules_file_name)


def get_osm_data(tile):
    osm_file = os.path.join('Cache', '%i-%i-%i.osm' % (tile[0], tile[1], tile[2]))
    diff = ''
    if os.path.exists(osm_file):
        App.log('Loading osm from file')
        Map.add_osm_source(osm_file)
        mtime = modification_date(osm_file)
        if datetime.datetime.now() - datetime.timedelta(days=1) < mtime:
            App.log('OSM date is less than a day old, using it')
            return
        mdate = modification_date(osm_file)
        diff = '[diff:"%s"]' % mdate.isoformat()
    bounds = tile2bounds(tile)
    App.log('Downloading osm data diff')
    command = 'download-osm-overpass bounds={1},{2},{3},{4} query="[timeout:1000]{0};(node($b$);rel(bn)->.x;way($b$);node(w)->.x;rel(bw););out;"'.format(
        diff, bounds.min_x, bounds.min_y, bounds.max_x, bounds.max_y )
    App.run_command(command)
    last_layer_index = len(Map.layers) - 1
    last_layer = Map.layers[last_layer_index]
    osm = last_layer.osm
    osm.save_xml_file(osm_file);


def get_contours(source, tile):
    counters_file = os.path.join('Cache', '%i-%i-%i-%s.contours' % (tile[0], tile[1], tile[2], source,))
    if os.path.exists(counters_file):
        App.log('Loading contours from file')
        App.run_command('load-source %s' % counters_file)
    else:
        App.log('Generating contours')
        bounds = tile2bounds(tile)
        App.run_command('set-dem-source %s' % source)
        App.run_command('generate-contours interval=10 min-ele=-410 bounds="%s"' % bounds)
        App.run_command('save-source %s' % counters_file)


def get_relief(tile):
    relief_file = os.path.join('Cache', '%i-%i-%i-relief.png' % (tile[0], tile[1], tile[2],))
    if os.path.exists(relief_file):
        App.log('Loading relief from file')
        App.run_command('load-image file="%s" background=false' % relief_file)
    else:
        App.log('Generating relief')
        bounds = tile2bounds(tile)
        App.run_command('generate-relief-igor bounds="%s"' % bounds)
        App.run_command('save-source %s' % relief_file)


def is_tile_generated(tile):
    tile_file = os.path.join('Tiles', str(tile[2]), str(tile[0]), '%i.png' % tile[1])
    return os.path.exists(tile_file)


def get_min_zoom(tile):
    result = tile[2]
    while 10 < result:
        parent_tile = get_parent_tile(tile, result)
        if is_tile_generated(parent_tile):
            return result + 1
        result -= 1
    return result


def generate_tiles(tile):
    min_zoom = min_zoom_value # get_min_zoom(tile)
    max_zoom = tile[2]
    parent_tile = get_parent_tile(tile, min_zoom_value)
    bounds = tile2bounds(parent_tile) # tile2middle_bounds(tile)
    if min_zoom <= tile[2]:
        App.log('Generating tiles, bounds: %s, min_zoom: %i, max_zoom: %i' % (bounds, min_zoom, max_zoom,))
        command = TileGenCommand(bounds, min_zoom, max_zoom)
        command.execute()
    else:
        App.log('Tiles already generated, bounds: %s' % bounds)


def read_input_file(file_name):
    tiles = []
    with open(file_name, 'r') as f:
        for line in f:
            tile = [int(x) for x in line.split(',')]
            tiles.append(tile)
    return tiles


def get_tile_data(tile):
    parent_tile = get_parent_tile(tile, min_zoom_value)
    if parent_tile in available_tiles:
        App.log('Tile data for %s is already available' % tile)
        return False;
    else:
        App.log('Creating tile data for %s' % tile)
        App.log('Creating parent tile data for %s' % parent_tile)
        get_osm_data(parent_tile)
        get_contours('SRTMV3R1', parent_tile)
        get_relief(parent_tile)
        available_tiles.append(parent_tile)
        return True;


def get_all_tiles(input_file, rules_file):
    Map.clear()
    use_rules_set(rules_file)
    tiles = read_input_file(input_file)
    for tile in tiles:
        if (get_tile_data(tile)):
            generate_tiles(tile)

App.run_command('set-setting name=user.earthdata-auth-token value=%s' % EARTHDATA_AUTH_TOKEN)
get_all_tiles('tiles.txt', 'Rules/IsraelHiking - en new.mrules')
# App.exit()
