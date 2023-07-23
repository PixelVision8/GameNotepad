--[[
    ## Space Station 8 `scene-game.lua`

    Learn more about making Pixel Vision 8 games at http://docs.pixelvision8.com
]]--

-- The game scene needs to load a few dependent scripts first.
require "micro-platformer"
require "entities"
require "entity-player"
require "entity-enemy"

-- We need to create a table to store all of the scene's functions.
GameScene = {}
GameScene.__index = GameScene

-- This create a new instance of the game scene
function GameScene:Init()

  EMPTY, SOLID, DOOR_OPEN, DOOR_LOCKED, ENEMY, SPIKE, LADDER, PLAYER, KEY =  0, 1, 2, 3, 4, 5, 6, 7, 8

  -- 
  local _game = {
    
    flagMap = {},
    microPlatformer = MicroPlatformer:Init(),
    invalidMap = false,
    paused = false

  }

  setmetatable(_game, GameScene) -- make Account handle lookup

  _game:RegisterFlags()

  return _game

end

-- Since we manually loaded up the tilemap and are not using a tilemap flag file we need to register the flags manually. We'll do this by creating a list of meta sprites and the flags that should be associate with each of their sprites.
function GameScene:RegisterFlags()
  
  -- First, we need to build a lookup table for all of the flags. We'll do this by getting the meta sprite's children sprites and associating them with a particular flag. We'll create a nested table that contains arrays. Each array will have an array of sprite ids and a flag id. The final items in the table will be structured as `{sprites, flag}` so when we loop through this later, we can access the sprite array at position `1` and the associated flag at index `2`.
  local spriteMap = {
    {"solid", SOLID},
    {"door-open", DOOR_OPEN},
    {"door-locked", DOOR_LOCKED},
    {"enemy", ENEMY},
    {"spike", SPIKE},
    {"ladder", LADDER},
    {"player", PLAYER},
    {"key", KEY},
  }

  -- Now we can loop through the sprite names and create a flag lookup table for each of the sprites.
  for i = 1, #spriteMap do

    -- Since we know that each nested array looks like `{sprites, flag}` we can access the sprite array at position `1` and the associated flag at index `2`. Setting these two variables at the top of the loop just makes it easier to access them.
    local spriteName = spriteMap[i][1]
    local flag = spriteMap[i][2]
    
--     print("Test", Sprite(spriteName).Sprites)
    
    -- Now we need to get all the sprites associated with the meta sprite's name by calling the `MetaSprite()` API.
    local sprites = Sprite(spriteName).Sprites

    -- Calling the `MetaSprite()` API returns a sprite collection. There are several properties and functions that can be called on the sprite collection. The most important one is the `Sprites` property which returns an array of all the sprites in the collection. Each item in the array is a `SpriteData` object which has an `Id` property we can use to determine which sprite in the collection should be associated with the flag.

    -- We'll loop through the flags and create a new array for each flag.
    for j = 1, #sprites do

      self.flagMap[sprites[j].Id] = flag

    end

  end

end

function GameScene:Reset()

  -- This reloads the tilemap into memory and restores any tiles that might have been removed in the last game.
  LoadTilemap("tilemap")

  -- This resets the physics engine to its default state.
  self.microPlatformer:Reset()

  -- Reset everything to default values
  self.atDoor = false
  
  -- Reset the key flag
  self.unlockExit = false
  
  local total = TilemapSize().C * (TilemapSize().R)

  -- We need to keep track of some flag while we iterate over all of the tiles in the map. These flags will keep track of the three main things each level needs, a player, a key, and a door.
  local foundPlayer = false
  local foundDoor = false
  local foundKey = false

  -- If we don't fine all of these the map can not be played. So we need to make sure we have all of them after we are done looping through the tiles and kick the player back to the previous screen so the game doesn't throw an error.
  
  -- Loop through all of the tiles
  for i = 1, total do

    local pos = CalculatePosition(i-1, TilemapSize().C)
    
    local tile = Tile(pos.X, pos.Y)

    local spriteId = tile.SpriteId

    local flag = EMPTY

    -- See if the sprite is mapped to a tile
    if(self.flagMap[spriteId] ~= nil) then

      -- Set the flag on the tile
      flag = self.flagMap[spriteId]

      -- Convert the x and y to pixels
      local x = pos.X * 8
      local y = pos.Y * 8

      if(flag == DOOR_OPEN or flag == DOOR_LOCKED) then
        
        if(foundDoor == false) then
          
          foundDoor = true

          -- Change the door to locked
          spriteId = Sprite("door-locked").Sprites[1].Id
          
          -- Lock the door
          flag = DOOR_LOCKED

          -- Save the door tile to unlock when the key is found
          self.doorTile = NewPoint(pos.X, pos.Y)

        else

          -- Remove any other door sprite from the map
          spriteId = EMPTY
          
        end

      -- enemy
      elseif(flag == ENEMY ) then
        
        local flip = Tile(pos.X, pos.Y).SpriteId ~= Sprite("enemy").Sprites[1].Id
      
        self.microPlatformer:AddEntity(Enemy:Init(x, y, flip))
        
        -- Remove any enemy sprites from the map
        spriteId = EMPTY
        flag = EMPTY

      -- player
      elseif(flag == PLAYER ) then
        
        if(foundPlayer == false) then

          local flip = Tile(pos.X, pos.Y).SpriteId ~= Sprite("player").Sprites[1].Id

          self.playerEntity = Player:Init(x, y, flip)

          self.microPlatformer:AddEntity(self.playerEntity)

          foundPlayer = true

        end

        -- Remove any player sprites from the map
        spriteId = EMPTY
        flag = EMPTY

      -- key
      elseif(flag == KEY ) then

        self.keyTile = NewPoint(pos.X, pos.Y)

        foundKey = true

      end
      
    end

    Tile(pos.X, pos.Y, spriteId, 0, flag)

  end


  if(foundPlayer == false or foundDoor == false or foundKey == false) then
    
    self.invalidMap = true
    self.paused = true

    DrawText("INVALID MAP", (Display().R/2) - 5, Display().C/3, DrawMode.Tile)
    
  end
  
end

function GameScene:Update(timeDelta)

  local td = timeDelta/1000

  if(Button(Buttons.Start, InputState.Released)) then

    self.paused = not self.paused

  end

  if(self.paused == true) then
    
    if(self.invalidMap ~= true) then
      DrawText("PAUSED", (Display().X/2) - 24, Display().Y/3)
    end
    
    return
  
  end

  if(TimerTriggered("RestartTimer")) then
          
    self:Reset()
    
    ClearTimer("RestartTimer")

  end

  local wasAlive = self.playerEntity.alive

  -- Update the player logic first so we always have the correct player x and y pos
  self.microPlatformer:Update(td)


  -- Check for collisions
  if(self.playerEntity.keyCollected and self.unlockExit == false) then

		self.unlockExit = true

    -- Clear the tile the player is currently in
    self:ClearTileAt(self.keyTile, EMPTY)
 
    self:ClearTileAt(self.doorTile, Sprite("door-open").Sprites[1].Id, DOOR_OPEN)

  elseif(self.playerEntity.currentFlag == DOOR_OPEN and self.atDoor == false) then
		
		self.atDoor = true

    NewTimer("RestartTimer", 500)

  end

  if(self.playerEntity.alive == false) then
    
    if(wasAlive == true) then

      NewTimer("RestartTimer", 500)
    
    end
 
  end

end


-- We can use this function to help making clearing tiles in the map easier. This is called when the player collects the key, gem, or the door is unlocked. It requires a position and an option new sprite id. By default, if no sprite id is provided, the tile will simply be cleared.
function GameScene:ClearTileAt(pos, newId, newFlag)

  newId = newId or EMPTY
  newFlag = newFlag or EMPTY

  Tile(pos.X, pos.Y, newId, 0, newFlag)

end

function GameScene:Draw()

  if(self.atDoor == false) then

    -- Need to draw the player last since the order of sprite draw calls matters
    self.microPlatformer:Draw()
  
  end

end