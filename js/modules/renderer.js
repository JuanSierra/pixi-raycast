/* Declaring all the variables outside of the loop is more efficient, 
   and works well with the original c++ code which is very procedural
   DON'T WORRY - as we're using browserify these will be scoped to
   this module */
var rayIdx, cameraX, rayPosX, rayPosY, rayDirX, rayDirY, mapX, mapY, 
    sideDistX, sideDistY, deltaDistX, deltaDistY, perpWallDist, stepX,
    stepY, hit, side, lineHeight, drawStart, drawEnd, color, time = 0,
    oldTime = 0, frameTime, tint, zBuffer = [], spriteOrder = [], 
    spriteDistance = [], spriteIdx, oldTime = 0, frameTime, tint, 
    shadowDepth = 12;
var posX = 22.0, posY = 11.5; //x and y start position
var dirX = -1.0, dirY = 0.0; //initial direction vector
var planeX = 0.0, planeY = 0.66; //the 2d raycaster version of camera plane
  
var Key = require('./input.js'),
    Config = require('./config.js'),
    Resources = require('./resources.js'),
    UI = require('./ui.js');

function update(camera) {
  drawWalls(camera, camera.map);
  // calculate delta time
  oldTime = time;
  time = performance.now();
  frameTime = (time - oldTime) / 1000;
  camera.update(frameTime);
}

function drawWalls(camera, map) {
  for (rayIdx = 0; rayIdx < Config.screenWidth; rayIdx++) {
    cameraX = 2 * rayIdx / Config.screenWidth - 1;
    rayPosX = camera.position.x;
    rayPosY = camera.position.y;
    rayDirX = camera.direction.x + camera.plane.x * cameraX;
    rayDirY = camera.direction.y + camera.plane.y * cameraX;
    // Which box we're in
    mapX = Math.floor(rayPosX);
    mapY = Math.floor(rayPosY);
    // Length of ray from current pos to next x or y side
    deltaDistX = Math.sqrt(1 + (rayDirY * rayDirY) / 
                           (rayDirX * rayDirX));
    deltaDistY = Math.sqrt(1 + (rayDirX * rayDirX) / 
                           (rayDirY * rayDirY));
    // was there a wall hit?
    hit = 0;
    // calculate step and initial sideDist
    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (rayPosX - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - rayPosX) * deltaDistX;
    }

    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (rayPosY - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - rayPosY) * deltaDistY;
    }

    while (hit == 0) {
      // jump to next map square
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      // check if ray has hit a wall
      if (map.wallGrid[Math.round(mapX)][Math.round(mapY)] > 0) {
        hit = 1;
      }
    }
    // calculate distance projected
    if (side == 0) {
      perpWallDist = Math.abs((mapX - rayPosX + (1 - stepX) / 2) / 
                              rayDirX);
    } else {
      perpWallDist = Math.abs((mapY - rayPosY + (1 - stepY) / 2) / 
                              rayDirY);
    }
    // calculate height of line
    lineHeight = Math.abs(Math.round(Config.screenHeight / perpWallDist));
    // calculate lowest and highest pixel to fill in
    drawStart = -lineHeight / 2 + Config.screenHeight / 2;
    drawEnd = lineHeight / 2 + Config.screenHeight / 2;

    if (side == 1) {
      wallX = rayPosX + ((mapY - rayPosY + (1 - stepY) / 2) / rayDirY) * rayDirX;
    } else {
      wallX = rayPosY + ((mapX - rayPosX + (1 - stepX) / 2) / rayDirX) * rayDirY;
    }
    wallX -= Math.floor(wallX);
    // grab the sprite for this wall slice
    var line = UI.getLayer('walls').children[rayIdx];
    // the x co-ordinate of the slice of wall texture
    var texX = Math.floor(wallX * Config.texWidth);
    if (side == 0 && rayDirX > 0) {
      texX = Config.texWidth - texX - 1;
    }
    if (side == 1 && rayDirY < 0) {
      texX = Config.texWidth - texX - 1;
    }
    // Pixi has easy tinting with hex values, let's use this to build a primitive
    // lighting system. Start out with a white (invisible) tint
    tint = 0xFFFFFF;
    if (side == 1) {
      // give one orientation of wall a darker tint for contrast
      tint -= 0x444444;
    }
    // also tint the slice darker, the further away it is
    // increase shadowDepth to make the level darker
    tint -= (0x010101 * Math.round(perpWallDist * shadowDepth));

    if (tint <= 0x000000) {
      tint = 0x000000;
    }
    // apply the tint
    line.tint = tint;
    // grab the texture for the index in the map grid
    texNum = map.wallGrid[mapX][mapY] - 1;
    // Grab the texture slice (these are presliced on load so 
    // no need for pixel buffer antics)
    line.setTexture(Resources.get('texture')[texNum][texX]);
    line.position.y = drawStart;
    line.height = drawEnd - drawStart;

    // store z dist for sprites!
    zBuffer[rayIdx] = perpWallDist;
  }

  map.sprites.sort(function (a, b) {
    var distanceA = ((camera.position.x - a.x) * (camera.position.x - a.x) + (camera.position.y - a.y) * (camera.position.y - a.y));
    var distanceB = ((camera.position.x - b.x) * (camera.position.x - b.x) + (camera.position.y - b.y) * (camera.position.y - b.y));
    if (distanceA < distanceB) {
      return -1
    }
    if (distanceA > distanceB) {
      return 1;
    }
    return 0;
  });
  
	// Temporal patch due to dirty stripes
    for (var x = 0; x < Config.screenWidth; x++) {
		var line = UI.getLayer('sprites').children[x];
		line.setTexture(Resources.get('barrel')[0][0]);
		line.position.y = 0;
		line.height = Config.screenHeight;
	}
  
  //after sorting the sprites, do the projection and draw them
   for(var texNum = 0; texNum < map.sprites.length; texNum++)
   {
      //translate sprite position to relative to camera
	  var spriteX = map.sprites[texNum].x - camera.position.x;
      var spriteY = map.sprites[texNum].y - camera.position.y;

      //transform sprite with the inverse camera matrix
      // [ planeX   dirX ] -1                                       [ dirY      -dirX ]
      // [               ]       =  1/(planeX*dirY-dirX*planeY) *   [                 ]
      // [ planeY   dirY ]                                          [ -planeY  planeX ]

      var invDet = 1.0 / (camera.plane.x * camera.direction.y - camera.direction.x * camera.plane.y); //required for correct matrix multiplication

      var transformX = invDet * (camera.direction.y * spriteX - camera.direction.x * spriteY);
      var transformY = invDet * (-camera.plane.y * spriteX + camera.plane.x * spriteY); //this is actually the depth inside the screen, that what Z is in 3D

      var spriteScreenX = parseInt((Config.screenWidth / 2) * (1 + transformX / transformY));

      //calculate height of the sprite on screen
      var spriteHeight = Math.abs(parseInt(Config.screenHeight / (transformY))); //using 'transformY' instead of the real distance prevents fisheye
      //calculate lowest and highest pixel to fill in current stripe
      var drawStartY = parseInt(-spriteHeight / 2 + Config.screenHeight / 2);
      if(drawStartY < 0) 
		  drawStartY = 0;
      var drawEndY = parseInt(spriteHeight / 2 + Config.screenHeight / 2);
      if(drawEndY >= Config.screenHeight) 
		  drawEndY = Config.screenHeight - 1;

      //calculate width of the sprite
      var spriteWidth = Math.abs( parseInt (Config.screenHeight / (transformY)));
      var drawStartX = parseInt(-spriteWidth / 2 + spriteScreenX);
      if(drawStartX < 0) 
		  drawStartX = 0;
      var drawEndX = parseInt(spriteWidth / 2 + spriteScreenX);
      if(drawEndX >= Config.screenWidth) 
		  drawEndX = Config.screenWidth - 1;

		//this.map.skybox.tilePosition.x
	
      //loop through every vertical stripe of the sprite on screen
	  //WHEN STRIPPED !!!
	  
      for(var stripe = drawStartX; stripe < drawEndX; stripe++)
      {
        var texX = parseInt( parseInt(256 * (stripe - (-spriteWidth / 2 + spriteScreenX)) * Config.texWidth / spriteWidth) / 256);
        //console.log("trans "+transformY + " zbuffer " + zBuffer[stripe] + "stripe "+ stripe)
		//the conditions in the if are:
        //1) it's in front of camera plane so you don't see things behind you
        //2) it's on the screen (left)
        //3) it's on the screen (right)
        //4) ZBuffer, with perpendicular distance
        if(transformY > 0 && stripe > 0 && stripe < Config.screenWidth && texX > 0)
		{
			/*for(var y = drawStartY; y < drawEndY; y++) //for every pixel of the current stripe
			{
			  var d = (y) * 256 - h * 128 + spriteHeight * 128; //256 and 128 factors to avoid floats
			  var texY = ((d * texHeight) / spriteHeight) / 256;
			  var color = texture[sprite[spriteOrder[i]].texture][Config.texWidth * texY + texX]; //get current color from the texture
			  if((color & 0x00FFFFFF) != 0) 
				  buffer[y][stripe] = color; //paint pixel if it isn't black, black is the invisible color
			}
			
			 var line = UI.getLayer('walls').children[rayIdx];*/
			//console.log('painting');
			
			if(transformY < zBuffer[stripe]){
				line.setTexture(Resources.get('barrel')[texNum][texX]);
				line.position.y = drawStartY;
				line.height = drawEndY - drawStartY;
			}else{
				var line = UI.getLayer('sprites').children[stripe];
				line.setTexture(Resources.get('barrel')[texNum][0]);
				line.position.y = drawStartY;
				line.height = drawEndY - drawStartY;
			}
		}
      }
	}
}

module.exports = update;
