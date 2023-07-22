// Import useNavigate from Solid's router. This is a hook that gives us a function
// that we can use to programmatically navigate to other routes in our app.
import { useNavigate } from "@solidjs/router"

// Import onMount from Solid. This is a lifecycle hook that we can use to run
// some code when this component is first mounted to the DOM.
import { onMount } from "solid-js"

// Import useOpenFolderDialog from a local file. This seems to be a custom hook
// that presumably opens a file dialog when called, and returns the selected folder.
import { useOpenFolderDialog } from "../lib/open-folder"

// Import state from another local file. This is likely the global state of your app,
// probably managed with Solid's built-in reactive state system.
import { state } from "../store"

// Define a functional component called Home.
export const Home = () => {
  // Get the navigate function from the useNavigate hook.
  const goto = useNavigate()

  // Get the openFolder function from the useOpenFolderDialog hook.
  const openFolder = useOpenFolderDialog()

  // When the component is first mounted to the DOM, this code will run.
  onMount(() => {
    // Get the first folder from the app state.
    const firstFolder = state.app.folders[0]

    // If there's a first folder, navigate to the /snippets route,
    // and pass the folder as a query parameter.
    if (firstFolder) {
      goto(
        `/snippets?${new URLSearchParams({ folder: firstFolder }).toString()}`
      )
    }
  })

  // The component returns some JSX, which is the UI of the component.
  // This will be a button in the center of the screen that, when clicked,
  // opens the open folder dialog.
  return (
    <div
      // A custom attribute used to specify a region that can be used to drag the window.
      data-tauri-drag-region
      // Tailwind CSS classes to style the div. This makes the div fill the screen and 
      // positions its children in the center, both vertically and horizontally.
      class="h-screen flex items-center justify-center"
    >
      <button
        // When the button is clicked, call the openFolder function.
        onClick={openFolder}
        // Tailwind CSS classes to style the button.
        class="cursor border rounded-lg shadow-sm h-10 px-3 active:bg-zinc-100 dark:active:bg-zinc-700"
      >
        Open Folder
      </button>
    </div>
  )
}
