import { basicSetup, EditorView } from "codemirror";
import { EditorState, EditorSelection, Transaction, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { useDarkMode } from "../lib/darkmode";
import { CompletionSource, CompletionContext, autocompletion, startCompletion } from '@codemirror/autocomplete';
// const { StateCommand, Selection } = EditorState;

type StateCommand = (context: {state: EditorState, dispatch: (tr: Transaction) => void}) => boolean;


// The Editor component. 
// It accepts the following props:
// - `value`: the initial content of the editor
// - `onChange`: a callback function to handle when the content of the editor changes
// - `extensions`: additional extensions to enhance the functionality of the editor
export const Editor = (props: {
  value: string
  onChange: (newValue: string) => void
  extensions?: Extension[]
}) => {
  // Create a variable to hold the HTML element where the EditorView will be rendered.
  let el: HTMLDivElement | undefined

  // Create a reactive signal for EditorView. 
  const [getView, setView] = createSignal<EditorView | undefined>()

  // Check if the application is running in dark mode.
  const isDarkMode = useDarkMode()

  // This is a list of PV8's APIs for demonstration purposes
  // You should replace this with the actual list of APIs
  const pixelVisionAPI = [
    { label: "BackgroundColor", signature: "BackgroundColor(id)", type: "function", info: "Manages system colors and the background color used to clear the display." },
    { label: "Color", signature: "Color(id, value)", type: "function", info: "Allows you to read and update color values in the ColorChip." },
    { label: "DrawRect", signature: "DrawRect(x, y, width, height, color, drawMode)", type: "function", info: "Displays a rectangle with a fill color on the screen." },
    { label: "DrawMetaSprite", signature: "DrawMetaSprite(id, x, y, flipH, flipV, drawMode, colorOffset)", type: "function", info: "Draws a Sprite Collection to the display." },
    { label: "DrawSprite", signature: "DrawSprite(id, x, y, flipH, flipV, drawMode, colorOffset)", type: "function", info: "Draws a single sprite to the display." },
    { label: "DrawText", signature: "DrawText(text, x, y, drawMode, font, colorOffset, spacing)", type: "function", info: "Renders text to the display." },
    { label: "ReadSaveData", signature: "ReadSaveData(key, defaultValue)", type: "function", info: "Reads saved data by supplying a key." },
    { label: "WriteSaveData", signature: "WriteSaveData(key, value)", type: "function", info: "Writes saved data by supplying a key and value." },
    { label: "Button", signature: "Button(Buttons button, InputState state, int controllerID)", type: "function", info: "Gets the current state of any button by calling the Button() method and supplying a button ID." },
    { label: "Key", signature: "Key(key, state)", type: "function", info: "Tests for keyboard input by calling the Key() API." },
    { label: "MouseButton", signature: "MouseButton(int button, InputState state)", type: "function", info: "Gets the current state of the mouse's left (0) and right (1) buttons by calling MouseButton()API." },
    { label: "MousePosition", signature: "MousePosition()", type: "function", info: "Returns a Point for the mouse cursor's X and Y position." },
    { label: "Init", signature: "Init()", type: "function", info: "Called when a game first loads up." },
    { label: "Draw", signature: "Draw()", type: "function", info: "Called once per frame after the Update() has been completed." },
    { label: "Update", signature: "Update(timeDelta)", type: "function", info: "Called once per frame at the beginning of the game loop." },
    { label: "PauseSong", signature: "PauseSong()", type: "function", info: "Toggles the current playback state of the sequencer." },
    { label: "PlaySong", signature: "PlaySong(id, loop, startAt)", type: "function", info: "Activates the MusicChip's tracker to playback any of the songs stored in memory." },
    { label: "RewindSong", signature: "RewindSong(position, patternID)", type: "function", info: "Rewinds the currently playing song to a specific position and pattern ID." },
    { label: "StopSong", signature: "StopSong()", type: "function", info: "Stops the currently playing song." },
    { label: "Display", signature: "Display()", type: "function", info: "Gets the resolution of the display at run time." },
    { label: "RedrawDisplay", signature: "RedrawDisplay()", type: "function", info: "Executes both the Clear() and DrawTilemap() APIs in a single call." },
    { label: "ScrollPosition", signature: "ScrollPosition(x, y)", type: "function", info: "Scrolls the tilemap by calling the ScrollPosition() API and supplying a new scroll X and Y position." },
    { label: "PlaySound", signature: "PlaySound(id, channel)", type: "function", info: "Plays a single sound effect on a specific channel." },
    { label: "Sound", signature: "Sound(int id, string data)", type: "function", info: "Reads raw sound data from the SoundChip." },
    { label: "StopSound", signature: "StopSound(channel)", type: "function", info: "Stops any sound playing on a specific channel." },
    { label: "Sprite", signature: "Sprite(id, data)", type: "function", info: "Reads and writes pixel data directly to the SpriteChip's memory." },
    { label: "TotalSprites", signature: "TotalSprites(bool ignoreEmpty)", type: "function", info: "Returns the total number of sprites in the SpriteChip." },
    { label: "Flag", signature: "Flag(column, row, value)", type: "function", info: "Quickly accesses just the flag value of a tile." },
    { label: "Tile", signature: "Tile(column, row, spriteID, colorOffset, flag, flipH, flipV)", type: "function", info: "Gets the current sprite, color offset and flag values associated with a given tile ID." },
    { label: "TilemapSize", signature: "TilemapSize(width, height, clear)", type: "function", info: "Returns a Pointrepresenting the size of the tilemap in columns(X) and rows (Y)." },
    { label: "UpdateTiles", signature: "UpdateTiles(ids, column, row, width, colorOffset, flag)", type: "function", info: "Updates the color offset and flag values of multiple tiles at once." },
  ];
  
  // A state signal to hold the currently selected option's info.
  const [getSelectedOptionInfo, setSelectedOptionInfo] = createSignal('');

  const completionSource: CompletionSource = (context: CompletionContext) => {
    const beforeCursor = context.state.sliceDoc(0, context.pos);
    const match = /\b\w+$/.exec(beforeCursor);

    if (!match) {
        return null;
    }

    const wordStart = match.index;
    
    return {
      from: wordStart,
      to: context.pos,
      options: pixelVisionAPI.map(api => ({
        label: api.signature,
        type: api.type,
      })),
    };
  };

  // Then you can use this completion source when you configure autocompletion
  const autocompleteExtension = autocompletion({ override: [completionSource] });

  const insertTab: StateCommand = ({state, dispatch}) => {
    // Get the current selection.
    let {from, to} = state.selection.main;
    // If there's a selection, delete it.
    if (from !== to) {
      const tr = state.update({changes: {from, to, insert: ""}});
      dispatch(tr);
    }
    // Insert four spaces at the current cursor position.
    const tr = state.update({changes: {from, to: from, insert: "    "}});
    dispatch(tr);
    // Move the caret to the end of the inserted spaces.
    const trSelection = state.update({selection: EditorSelection.single(from + 4)});
    dispatch(trSelection);
    return true;
};

const deleteSpaces: StateCommand = ({state, dispatch}) => {
    // Get the current selection.
    let {from, to} = state.selection.main;
    // If there's a selection, delete it.
    if (from !== to) {
      const tr = state.update({changes: {from, to, insert: ""}});
      dispatch(tr);
    }
    // If the four characters before the cursor are spaces, delete them.
    else if (state.doc.sliceString(from - 4, from) === "    ") {
      const tr = state.update({changes: {from: from - 4, to: from, insert: ""}});
      dispatch(tr);
    }
    return true;
};

  
  const tabKeymap = keymap.of([
    { key: "Tab", run: insertTab },
    { key: "Shift-Tab", run: deleteSpaces },
    { key: "Alt-Space", run: startCompletion}
  ]);
  

  // Run the following code after the component is mounted.
  onMount(() => {
    // Create an update listener that gets triggered when there are any changes in the EditorView.
    const handleUpdate = EditorView.updateListener.of((update) => {
      const value = update.state.doc.toString() // Convert the current document in the EditorView to a string.
      props.onChange(value) // Call the onChange function with the new value.
    })

    // Define a function to create a new EditorView.
    const createView = () => {
      return new EditorView({
        parent: el, // Parent element is the HTML element defined above.
        state: EditorState.create({
          doc: "", // Initial content of the editor.
          extensions: [
            // Add different extensions based on whether the app is in dark mode or not.
            isDarkMode() ? githubDark : githubLight,
            basicSetup,
            autocompletion({
              override: [completionSource], // Use the PV8 completion source
            }),
            // startCompletion, // Start completion immediately
            handleUpdate,
            EditorView.lineWrapping,
            ...(props.extensions || []),
            tabKeymap,
            
          ],
        }),
      })
    }

    // Create an effect that creates a new EditorView and cleans up when it's no longer needed.
    createEffect(() => {
      const view = createView() // Create a new EditorView.
      setView(view) // Set the view signal to the newly created EditorView.

      // Cleanup function to be run when the EditorView is unmounted.
      onCleanup(() => {
        view.destroy() // Destroy the EditorView.
      })
    })

    // Create an effect that updates the content of the EditorView whenever the value prop changes.
    createEffect(() => {
      const view = getView() // Get the current EditorView.
      if (!view) return // If there is no EditorView, do nothing.
      const oldValue = view.state.doc.toString() // Get the current content of the EditorView.
      // If the value prop is different from the current content of the EditorView,
      // dispatch an action to update the content.
      if (props.value !== oldValue) {
        view.dispatch({
          changes: { from: 0, to: oldValue.length, insert: props.value },
        })
      }
    })
  })

  // Render a div element where the EditorView will be created.
  return <div class="h-full" ref={el}></div>
}
