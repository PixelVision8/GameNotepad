import { basicSetup, EditorView } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { useDarkMode } from "../lib/darkmode";

const { StateCommand, Selection } = EditorState;
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

  const insertTab: StateCommand = ({state, dispatch}) => {
    // Get the current selection.
    let {from, to} = state.selection.main;
    // If there's a selection, delete it.
    if (from !== to) dispatch({changes: {from, to, insert: ""}});
    // Insert four spaces at the current cursor position.
    dispatch({changes: {from, to: from, insert: "    "}});
    // Move the caret to the end of the inserted spaces.
    dispatch({selection: {anchor: from + 4}});
    return true;
  };
  
  const deleteSpaces: StateCommand = ({state, dispatch}) => {
    // Get the current selection.
    let {from, to} = state.selection.main;
    // If there's a selection, delete it.
    if (from !== to) dispatch({changes: {from, to, insert: ""}});
    // If the four characters before the cursor are spaces, delete them.
    else if (state.doc.sliceString(from - 4, from) === "    ") {
      dispatch({changes: {from: from - 4, to: from, insert: ""}});
    }
    return true;
  };
  
  const tabKeymap = keymap.of([
    { key: "Tab", run: insertTab },
    { key: "Shift-Tab", run: deleteSpaces } // Add this line
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
            handleUpdate,
            EditorView.lineWrapping,
            ...(props.extensions || []),
            tabKeymap
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
