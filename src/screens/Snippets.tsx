// Imports necessary modules and components
import { Link, useNavigate, useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
} from "solid-js";
import { confirm } from "@tauri-apps/api/dialog";
import { Editor } from "../components/Editor";
import {
  FolderHistoryModal,
  LanguageModal,
  VSCodeSnippetSettingsModal,
} from "../components/Modal";
import { getLanguageName, languages } from "../lib/languages";
import { debounce } from "../lib/utils";
import { actions, state } from "../store";
import { Button } from "../components/Button";
import { timeago } from "../lib/date";
import { tooltip } from "../lib/tooltip";
import { path } from "@tauri-apps/api";
import { useFormControl } from "../lib/use-form-control";
import { Game } from '../components/Game';  // adjust the path as needed

// Snippets component
export const Snippets = () => {
  // Setting up navigation hook
  const goto = useNavigate();

  // Using search params hook to get folder and id from the url
  const [searchParams] = useSearchParams<{ folder: string; id?: string }>();

  // State for content using Solid's createSignal
  const [content, setContent] = createSignal("");

  // States for modals
  const [getOpenLanguageModal, setOpenLanguageModal] = createSignal(false);
  const [getOpenFolderHistoryModal, setOpenFolderHistoryModal] =
    createSignal(false);

  // States for search
  const [getSearchType, setSearchType] = createSignal<
    null | "non-trash" | "trash"
  >(null);
  const [getSearchKeyword, setSearchKeyword] = createSignal<string>("");

  // State for selected snippets
  const [getSelectedSnippetIds, setSelectedSnippetIds] = createSignal<string[]>(
    []
  );

  // State for VSCode snippet settings modal
  const [getOpenVSCodeSnippetSettingsModal, setOpenVSCodeSnippetSettingsModal] =
    createSignal<string | undefined>();

  // Placeholder for search input HTML element
  let searchInputEl: HTMLInputElement | undefined;

  // Creating a form control for name input
  const nameInputControl = useFormControl({
    defaultValue: "",
    async save(value) {
      await actions.updateSnippet(snippet()!.id, "name", value);
    },
  });

  // Memoizes a function that filters and sorts the snippets
  // This will rerun and update whenever the state that it depends on changes.
  const snippets = createMemo(() => {
    // Converts the search keyword to lowercase
    const keyword = getSearchKeyword().toLowerCase();

    // Filters and sorts the state snippets based on certain conditions
    return (
      state.snippets
        .filter((snippet) => {
          const conditions: (string | boolean | undefined | null)[] = [];

          // Adds condition based on whether snippet is in trash or not
          conditions.push(
            getSearchType() === "trash" ? snippet.deletedAt : !snippet.deletedAt
          );

          // If keyword exists, adds condition to check if snippet name includes keyword
          if (keyword) {
            conditions.push(snippet.name.toLowerCase().includes(keyword));
          }

          // Returns true if all conditions are true
          return conditions.every((v) => v);
        })
        // Sorts snippets based on created date or deleted date
        .sort((a, b) => {
          if (a.deletedAt && b.deletedAt) {
            return a.deletedAt > b.deletedAt ? -1 : 1;
          }
          return a.createdAt > b.createdAt ? -1 : 1;
        })
    );
  });

  // Memoizes a function that provides the actual selected snippet IDs
  // It adds the ID from the search params to the currently selected snippet IDs
  const actualSelectedSnippetIds = createMemo(() => {
    const ids = [...getSelectedSnippetIds()];
    if (searchParams.id && snippets().some((s) => s.id === searchParams.id)) {
      ids.push(searchParams.id);
    }
    return ids;
  });

  // Memoizes a function that gets the current snippet based on the id from the search parameters
  const snippet = createMemo(() =>
    state.snippets.find((snippet) => snippet.id === searchParams.id)
  );

  // Function to check if a snippet is active in the sidebar
  // It is considered active if its id matches the id of the current snippet or it is among the selected snippet ids
  const isSidebarSnippetActive = (id: string) => {
    return id === snippet()?.id || getSelectedSnippetIds().includes(id);
  };

  // Memoizes a function to get the language extension of the current snippet
  // It does this by finding the language in the predefined languages list that matches the language of the current snippet
  const languageExtension = createMemo(() => {
    const lang = languages.find((lang) => lang.id === snippet()?.language);
    return lang && lang.extension;
  });
  // Function to create a new snippet with the default properties
  const newSnippet = async () => {
    const d = new Date();
    const id = actions.getRandomId(); // Generates a random id
    // Calls the createSnippet action to create a new snippet
    await actions.createSnippet(
      {
        id,
        name: "Untitled",
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
        language: "plaintext",
      },
      ""
    );
    setSearchType(null); // Resets the search type
    // Navigates to the new snippet's page
    goto(
      `/snippets?${new URLSearchParams({ ...searchParams, id }).toString()}`
    );
  };

  // Debounced function to handle editor content changes
  // If the new value is the same as the old, it returns early
  // Otherwise, it updates the snippet content and the local content state
  const handleEditorChange = debounce((value: string) => {
    if (value === content()) return;
    console.log("saving content..");
    actions.updateSnippetContent(snippet()!.id, value);
    setContent(value);
  }, 250); // 250ms debounce delay

  // Function to move a snippet to trash or restore it from trash
  const moveSnippetToTrashOrRestore = async (id: string) => {
    // Finds the snippet with the given id
    const snippet = state.snippets.find((snippet) => snippet.id === id);
    if (!snippet) {
      console.error("snippet not found");
      return;
    }
    // Checks if the snippet is already in trash
    if (snippet.deletedAt) {
      // Asks the user for confirmation before restoring the snippet
      if (
        await confirm(
          `Are you sure you want to restore this snippet from Trash?`
        )
      ) {
        console.log(`restoring ${id}:${snippet.name} from trash`);
        await actions.moveSnippetsToTrash([id], true);
      }
    } else {
      // Asks the user for confirmation before moving the snippet to trash
      if (await confirm(`Are you sure you want to move it to Trash?`)) {
        console.log(`moving ${id}:${snippet.name} to trash`);
        await actions.moveSnippetsToTrash([id]);
      }
    }
  };

  // Function to move multiple snippets to trash or restore them from trash
  const moveSelectedSnippetsToTrashOrRestore = async () => {
    const restore = getSearchType() === "trash"; // Determines whether to restore or move to trash
    // Asks the user for confirmation
    if (
      await confirm(
        restore
          ? `Are you sure you want to restore selected snippets from Trash`
          : `Are you sure you want to move selected snippets to Trash?`
      )
    ) {
      // Moves or restores the selected snippets
      await actions.moveSnippetsToTrash(actualSelectedSnippetIds(), restore);
      setSelectedSnippetIds([]); // Resets the selected snippet ids
    }
  };
  // Function to permanently delete a snippet
  const deleteForever = async (id: string) => {
    // Ask the user for confirmation before deletion
    if (
      await confirm(`Are you sure you want to delete this snippet forever?`)
    ) {
      await actions.deleteSnippetForever(id); // If confirmed, delete the snippet
    }
  };

  // Function to empty the trash
  const emptyTrash = async () => {
    // Ask the user for confirmation before emptying the trash
    if (
      await confirm(
        `Are you sure you want to permanently erase the items in the Trash?`
      )
    ) {
      await actions.emptyTrash(); // If confirmed, empty the trash
    }
  };

  // Define the reactive state
  const [gameState, setGameState] = createSignal(false);

  // Create a function to handle the button click
  const handlePlayButtonClick = () => {
    // Update the state
    setGameState(!gameState());
  }

  // Effect to focus the search input when search type is present
  createEffect(() => {
    if (getSearchType()) {
      searchInputEl?.focus();
    }
  });

  // Effect to reset the search keyword when search type changes
  createEffect(
    on(getSearchType, () => {
      setSearchKeyword("");
    })
  );

  // Effect to set the folder in the store based on search parameters
  createEffect(() => {
    actions.setFolder(searchParams.folder || null);
  });

  // Effect to load snippets from a folder
  createEffect(
    on(
      () => [searchParams.folder],
      () => {
        if (!searchParams.folder) return;

        // Load snippets from the specified folder
        actions.loadFolder(searchParams.folder);

        // Reload snippets from the folder every 2 seconds
        const watchFolder = window.setInterval(() => {
          actions.loadFolder(searchParams.folder);
        }, 2000);

        // Clean up the interval when the effect ends
        onCleanup(() => {
          window.clearInterval(watchFolder);
        });
      }
    )
  );

  // Effect to update the name input's value with the snippet's name
  createEffect(() => {
    const s = snippet();
    if (s) {
      nameInputControl.setValue(s.name);
    }
  });
  // Function to load the content of a snippet
  const loadContent = async () => {
    if (!searchParams.id) return; // If there's no id in search parameters, exit the function

    const content = await actions.readSnippetContent(searchParams.id); // Fetch snippet content from the store
    setContent(content); // Update the content state
  };

  // Effect to load snippet content
  createEffect(
    on(
      () => [searchParams.id],
      () => {
        loadContent(); // Load the content

        // Reload the snippet content every 2 seconds
        const watchFile = window.setInterval(async () => {
          loadContent();
        }, 2000);

        // Clear the interval when the effect ends
        onCleanup(() => {
          window.clearInterval(watchFile);
        });
      }
    )
  );

  // Effect to unselect snippets when either the search parameter id or the search type changes
  createEffect(
    on([() => searchParams.id, getSearchType], () => {
      setSelectedSnippetIds([]); // Unselect all snippets
    })
  );

  {
    /* JSX structure is returned here. It defines how the UI will look */
  }
  return (
    // Outermost div element for the page; 'is-mac' class is conditionally applied
    <div class="h-screen" classList={{ "is-mac": state.isMac }}>
      {/* A container that includes the sidebar and main content */}
      <div class="h-main flex">
        {/* Sidebar container with a condition to show search if search type is not null */}
        <div
          class="border-r w-64 shrink-0 h-full flex flex-col"
          classList={{ "show-search": getSearchType() !== null }}
        >
          {/* The topmost part of the sidebar */}
          <div class="sidebar-header text-zinc-500 dark:text-zinc-300 text-xs">
            {/* If the operating system is Mac, render a draggable div of height 6px */}
            <Show when={state.isMac}>
              <div class="h-6" data-tauri-drag-region></div>
            </Show>

            {/* Draggable div containing button to open the folder history and other controls */}
            <div
              data-tauri-drag-region
              class="flex items-center justify-between px-2 h-10 shrink-0"
            >
              {/* Button to open the folder history modal */}
              <Button
                type="button"
                onClick={() => setOpenFolderHistoryModal(true)}
                tooltip={{ content: "Select folder" }}
                icon="i-bi:folder"
                class="-ml-[1px] max-w-[50%]"
              >
                {state.folder?.split(path.sep).pop()}{" "}
                {/* Display the name of the current folder */}
              </Button>

              {/* Container for the new snippet, search, and trash buttons */}
              <div class="flex items-center">
                {/* Button to create a new snippet */}
                <Button
                  type="button"
                  icon="i-ic:outline-add"
                  onClick={newSnippet}
                  tooltip={{ content: "New snippet" }}
                ></Button>

                {/* Button to toggle the search box */}
                <Button
                  type="button"
                  icon="i-material-symbols:search"
                  onClick={() => {
                    if (getSearchType() === "non-trash") {
                      setSearchType(null);
                      return;
                    }
                    setSearchType("non-trash");
                  }}
                  tooltip={{ content: "Show search box" }}
                  isActive={getSearchType() === "non-trash"}
                ></Button>

                {/* Button to toggle the visibility of snippets in the trash */}
                <Button
                  type="button"
                  icon="i-iconoir:bin"
                  onClick={() => {
                    if (getSearchType() === "trash") {
                      setSearchType(null);
                      return;
                    }
                    setSearchType("trash");
                  }}
                  tooltip={{ content: "Show snippets in trash" }}
                  isActive={getSearchType() === "trash"}
                ></Button>
              </div>
            </div>

            {/* Only show the following elements when getSearchType() returns a truthy value */}
            <Show when={getSearchType()}>
              {/* A div that contains the search or trash control elements */}
              <div class="px-3 pb-2">
                {/* Flex container for aligning elements horizontally */}
                <div class="flex justify-between pb-1 text-xs">
                  {/* Display either 'Trash' or 'Search' based on the value of getSearchType() */}
                  <span class="text-zinc-500 dark:text-zinc-300">
                    {getSearchType() === "trash" ? "Trash" : "Search"}
                  </span>
                  {/* Only show the following 'Empty' button when getSearchType() returns 'trash' */}
                  <Show when={getSearchType() === "trash"}>
                    {/* 'Empty' button for emptying the trash. It's disabled when there are no snippets */}
                    <button
                      type="button"
                      disabled={snippets().length === 0}
                      class="cursor whitespace-nowrap border-zinc-400 dark:border-zinc-600 border h-5/6 rounded-md px-2 flex items-center"
                      classList={{
                        "active:bg-zinc-200 dark:active:bg-zinc-700":
                          snippets().length !== 0,
                        "disabled:opacity-50": true,
                      }}
                      onClick={emptyTrash}
                    >
                      Empty
                    </button>
                  </Show>
                </div>
                {/* Input container for searching */}
                <div class="h-2/5">
                  {/* Search input field */}
                  <input
                    ref={searchInputEl}
                    spellcheck={false}
                    class="h-7 w-full flex items-center px-2 border rounded-lg bg-transparent focus:ring focus:border-blue-500 ring-blue-500 focus:outline-none"
                    value={getSearchKeyword()!}
                    // Event listener for user input. Updates search keyword as user types
                    onInput={(e) => setSearchKeyword(e.currentTarget.value)}
                    // Event listener for keypress. If 'Escape' is pressed, setSearchType is set to null
                    onKeyPress={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setSearchType(null);
                      }
                    }}
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* Sidebar body with a custom scrollbar. The .group/sidebar-body classes might be a part of a custom library or framework */}
          <div class="sidebar-body group/sidebar-body flex-1 overflow-y-auto custom-scrollbar scrollbar-group p-2 pt-0 space-y-1">
            {/* Iterating over each item in the 'snippets' array */}
            <For each={snippets()}>
              {(snippet) => {
                return (
                  // Each snippet is a clickable link that updates the URL's searchParams with the respective snippet id */}
                  <Link
                    href={`/snippets?${new URLSearchParams({
                      ...searchParams,
                      id: snippet.id,
                    }).toString()}`}
                    classList={{
                      "group text-sm px-2 block select-none rounded-lg py-1 cursor":
                        true,
                      "bg-blue-500": isSidebarSnippetActive(snippet.id),
                      "hover:bg-zinc-100 dark:hover:bg-zinc-600":
                        !isSidebarSnippetActive(snippet.id),
                      "text-white": isSidebarSnippetActive(snippet.id),
                    }}
                    // Implementing multi-select functionality when the shift key is held during click
                    onClick={(e) => {
                      // Check if the game is currently in the "playing" state
                      if (gameState()) {
                        // Stop the game if it is playing
                        handlePlayButtonClick();
                      }
                      if (e.shiftKey) {
                        e.preventDefault();
                        setSelectedSnippetIds((ids) => {
                          if (ids.includes(snippet.id)) {
                            return ids.filter((_id) => _id !== snippet.id);
                          }
                          return [...ids, snippet.id];
                        });
                      }
                    }}
                  >
                    {/* Displaying the truncated name of the snippet */}
                    <div class="truncate">{snippet.name}</div>
                    {/* Displaying additional snippet details */}
                    <div
                      class="text-xs grid grid-cols-2 gap-1 mt-[1px]"
                      classList={{
                        "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-400":
                          !isSidebarSnippetActive(snippet.id),
                        "text-blue-100": isSidebarSnippetActive(snippet.id),
                      }}
                    >
                      {/* Displaying the time when the snippet was created */}
                      <span class="truncate">{timeago(snippet.createdAt)}</span>
                      {/* Implementing snippet options which are visible only when hovered over */}
                      <div class="flex justify-end items-center opacity-0 group-hover/sidebar-body:opacity-100">
                        {/* Button for opening the snippet settings. Tooltip shows when hovered over the button */}
                        <button
                          type="button"
                          use:tooltip={{
                            content: snippet.vscodeSnippet?.prefix?.trim()
                              ? snippet.vscodeSnippet.prefix
                              : "Set Snippet Prefix",
                            placement: "top-end",
                          }}
                          class="cursor flex justify-end items-center max-w-full"
                          classList={{
                            "hover:text-white": isSidebarSnippetActive(
                              snippet.id
                            ),
                            "hover:text-zinc-500": !isSidebarSnippetActive(
                              snippet.id
                            ),
                          }}
                          onClick={(e) => {
                            setOpenVSCodeSnippetSettingsModal(snippet.id);
                          }}
                        >
                          {/* Displaying the snippet prefix if it's available, else showing a fallback icon */}
                          <Show
                            when={snippet.vscodeSnippet?.prefix?.trim()}
                            fallback={
                              <span class="i-fluent:key-command-16-filled text-inherit"></span>
                            }
                          >
                            <span class="truncate">
                              {snippet.vscodeSnippet!.prefix}
                            </span>
                          </Show>
                        </button>
                      </div>
                    </div>
                  </Link>

                );
              }}
            </For>
          </div>
        </div>

        <Show
          // Display content when a snippet is selected, otherwise show a fallback message
          when={snippet()}
          fallback={
            <div
              data-tauri-drag-region
              class="h-full w-full flex items-center justify-center px-20 text-center text-zinc-400 text-xl"
            >
              <span class="select-none">
                {/* The fallback message when no snippet is selected */}
                Select or create a game script from sidebar
              </span>
            </div>
          }
        >
          {/* Main content area when a snippet is selected */}
          <div data-tauri-drag-region class="w-full h-full" >
          <div data-tauri-drag-region="" class="h-6"></div>
            {/* Header section of the selected snippet */}
            <div
              class="border-b flex h-mainHeader items-center px-3 justify-between space-x-3"
            >
              {/* Input field for the name of the selected snippet */}
              <input
                value={nameInputControl.value}
                spellcheck={false}
                class="w-full h-full focus:outline-none bg-transparent"
                onInput={nameInputControl.onInput}
              />
              {/* Action buttons for selected snippet */}
              <div class="flex items-center text-xs text-zinc-500 dark:text-zinc-300 space-x-1">
                {/* Button for selecting the language of the snippet - icon came from https://icon-sets.iconify.design/majesticons/play-circle-line/ and use majesticons:stop-circle-line
 for the stop button*/}
                <div class={gameState() ? "hidden" : ""}>
                  <Button
                    type="button"
                    icon="i-majesticons:curly-braces"
                    onClick={() => setOpenLanguageModal(true)}
                    tooltip={{ content: "Select language mode" }}
                  >
                    {/* Display the name of the selected language */}
                    {getLanguageName(snippet()!.language || "plaintext")}
                  </Button>
                </div>
                
                {/* Adding the new "Run" button */}
                <Button
                  type="button"
                  icon={gameState() ? "i-ic:baseline-stop" : "i-ic:baseline-play-arrow"}
                  class="w-16"
                  onClick={handlePlayButtonClick}
                >
                  {gameState() ? "Stop" : "Run\u00A0"}
                </Button>
                {/* Button for showing more options */}
                <div class="group relative">
                  <Button icon="i-ic:baseline-more-horiz"></Button>
                  {/* Dropdown for more options */}
                  <div
                    aria-label="Dropdown"
                    class="hidden absolute bg-white dark:bg-zinc-700 z-10 py-1 right-0 min-w-[100px] border rounded-lg shadow group-hover:block"
                  >
                    {/* Option to open VSCode snippet settings */}
                    <button
                      type="button"
                      class="cursor w-full px-3 h-6 flex items-center whitespace-nowrap hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-500"
                      onClick={() =>
                        setOpenVSCodeSnippetSettingsModal(snippet()!.id)
                      }
                    >
                      VSCode snippet
                    </button>
                    {/* Option to move the snippet to trash or restore it */}
                    <button
                      type="button"
                      class="cursor w-full px-3 h-6 flex items-center whitespace-nowrap hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-500"
                      onClick={() => moveSnippetToTrashOrRestore(snippet()!.id)}
                    >
                      {/* Conditionally display the button label based on whether the snippet is deleted */}
                      {snippet()!.deletedAt
                        ? "Restore from Trash"
                        : "Move to Trash"}
                    </button>
                    {/* Option to delete the snippet forever, only shows if the snippet is deleted */}
                    <Show when={snippet()!.deletedAt}>
                      <button
                        type="button"
                        class="cursor w-full px-3 h-6 flex items-center whitespace-nowrap hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-500"
                        onClick={() => deleteForever(snippet()!.id)}
                      >
                        Delete forever
                      </button>
                    </Show>
                  </div>
                </div>
              </div>
            </div>
            {/* Main body section for displaying the content of the snippet added a hack to bring the bottom of the editor panel up to remove additional scroll bar */}
            <div class="h-mainBody overflow-y-auto" style={{ height: "calc(100% - 4rem)" }}>
              {/* Editor component for editing the content of the snippet */}
              <Show when={!gameState()}>
                <Editor
                  value={content()}
                  onChange={handleEditorChange}
                  extensions={languageExtension() ? [languageExtension()!()] : []}
                />
              </Show>
              <Show when={gameState()}>
                <Game />
              </Show>
            </div>
          </div>
        </Show>
      </div>
      {/* Footer section */}
      <footer class="h-footer"></footer>
      {/* Modals for language selection, folder history, and VSCode snippet settings */}
      <LanguageModal
        open={getOpenLanguageModal()}
        setOpen={setOpenLanguageModal}
        setLanguage={(language) =>
          actions.updateSnippet(snippet()!.id, "language", language)
        }
      />
      <FolderHistoryModal
        open={getOpenFolderHistoryModal()}
        setOpen={setOpenFolderHistoryModal}
      />
      <VSCodeSnippetSettingsModal
        snippetId={getOpenVSCodeSnippetSettingsModal()}
        close={() => setOpenVSCodeSnippetSettingsModal(undefined)}
      />
      {/* Button for moving multiple selected snippets to trash or restoring them */}
      <div
        classList={{
          "-bottom-10": getSelectedSnippetIds().length === 0,
          "bottom-10": getSelectedSnippetIds().length > 0,
        }}
        class="fixed left-1/2 transform -translate-x-1/2"
        style="transition: bottom .3s ease-in-out"
      >
        <button
          type="button"
          class="cursor inline-flex items-center bg-white dark:bg-zinc-700 rounded-lg shadow border px-3 h-9 hover:bg-zinc-100"
          onClick={moveSelectedSnippetsToTrashOrRestore}
        >
          {/* Conditionally display the button label based on whether the snippets are in the trash */}
          {getSearchType() === "trash"
            ? `Restore ${actualSelectedSnippetIds().length} snippets from Trash`
            : `Move ${actualSelectedSnippetIds().length} snippets to Trash`}
        </button>
      </div>
    </div>
  );
};
