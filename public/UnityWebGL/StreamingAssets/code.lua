--[[
  ## Space Station 64 `code.lua`
  
  This is the main `code.lua` file that runs  the entire game. It's responsible for loading in all the game code, managing the game's state, and loading/saving the map.

  Learn more about making Pixel Vision 8 games at http://docs.pixelvision8.com
]]--

-- We use the `LoadScript()` API to load each Lua file inside of the `/Game/Src/` directory. We can use this API to break down game logic into smaller, self-contained files.

require "scene-game"

-- Pixel Vision 8 will ignore scripts it's can't fine in the game's `Src` directory which is helpful if you are just sketching out a game and where you want to put the logic.

-- Since variable in Lua are global by default we can take advantage of this and create global constants to emulate an enum you'd find in other languages like C#. Here we define all of the game modes and set a int value to make it easier to switch between scenes by name instead of memorizing the Id.
GAME = 1

-- Here we set up several local variables to store the scenes, the active scene, and the active scene Id.
local scenes = nil
local activeScene = nil
local activeSceneId = 1

-- The `Init()` function is part of the game's lifecycle and called a when a game starts. We'll use this function to configure the mask colors, background color, and scene instances.
function Init()

  -- Change the background to `#937AC5`.
  BackgroundColor(Plum)
  
  -- Now we are going to create a table for each scene instance by calling the scene's Init() function.
  scenes = {
    GameScene:Init(),
  }

  --[[
  If you try to run the code before you have a scene before you create the code for it, you will get an error. You can create `scene-game.lua` in your `/Game/Src/` folder as a place holder while we get the rest of the game working: . 
  
  You can use the following template for each scene's code file, just replace the scene name with the scene you are creating.

  ```lua

  LoaderScene = {}
  LoaderScene.__index = LoaderScene

  function LoaderScene:Init()

    local _loader = {
    }

    setmetatable(_loader, LoaderScene)

    return _loader

  end

  ```

  ]]--

  -- Now that we have all of the scenes loaded into memory, we can call the `SwitchScene()` function and load the default scene.
  SwitchScene(GAME)

end

-- We use this function to prepare a new scene and run through all of the steps required to make sure the new scene is correctly reset and ready to go.
function SwitchScene(id)

  -- We want to save the active scene Id incase we need it later.
  activeSceneId = id

  -- Here we are saving the instance of the active scene so we can call `Update()` and `Draw()` on whichever scene is currently active.
  activeScene = scenes[activeSceneId]

  -- Finally, we need to reset the scene before it is loaded.
  activeScene:Reset()

  -- Since each scene is already instantiated, its `Init()` function won't be called again. We will use the `Reset()` function to restore the default values and state before loading it.

end

--[[ 
  The `Update()` function is part of the game's life cycle. The engine calls `Update()` on every frame before drawing anything to the display. It accepts one argument, `timeDelta`, which is the difference in milliseconds since the last frame. You can use the `timeDelta` to sync animations and physics to the framerate incase it drops between frames.

  The game's `Update()` function is where you'll want to do all your physics calculations, capture input changes, and any other logic that does not require rendering.
]]--
function Update(timeDelta)
  
  -- We need to check to see if there is an active scene before trying to update it. If one exists, we'll call `Update()` on the active scene and pass in the timeDelta.
  if(activeScene ~= nil) then

    activeScene:Update(timeDelta)
  
  end

end

-- The `Draw()` function is part of the game's life cycle. It is called after `Update()` and is where all of our draw calls should go.
function Draw()

  -- We can use the `RedrawBackground()` method to clear the screen and copy the tilemap cache (which contains a pre-rendered tilemap) to the display.
  RedrawBackground()

  -- Check to see if there is an active scene before trying to draw it.
  if(activeScene ~= nil) then

    -- Call the active scene's `Draw()` function.
    activeScene:Draw()
  
  end

end