// import statements for required libraries and modules
import { nanoid } from "nanoid";
import { fs, path, dialog, os } from "@tauri-apps/api";
import { BaseDirectory } from "@tauri-apps/api/fs";
import { createStore } from "solid-js/store";

// Interface for the Snippet data structure
export interface Snippet {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  language?: string;
  deletedAt?: string;
  vscodeSnippet?: {
    prefix?: string;
  };
}

// Interface for AppData containing folders array
interface AppData {
  folders: string[];
}

// Creating a store to manage the application state
const [state, setState] = createStore<{
  ready: boolean;
  app: AppData;
  folder: string | null;
  snippets: Snippet[];
  isMac: boolean;
}>({
  ready: false, // Indicates if the application is ready
  app: {
    folders: [], // Array to store folder paths
  },
  folder: null, // Stores the selected folder path, initially set to null
  snippets: [], // Array to store snippets
  isMac: /macintosh/i.test(navigator.userAgent), // Boolean flag to detect if the user is on a Mac
});

// Exporting the application state
export { state };
// Function to write the snippets data to a JSON file
const writeSnippetsJson = async (folder: string, snippets: Snippet[]) => {
  console.log("writing snippets.json"); // Logging a message for debugging purposes
  await fs.writeTextFile(
    await path.join(folder, "snippets.json"),
    JSON.stringify(snippets)
  );
};

// Function to write the application data to a JSON file
const writeAppJson = async (appData: AppData) => {
  await fs.createDir("", { dir: BaseDirectory.App, recursive: true });
  await fs.writeTextFile("app.json", JSON.stringify(appData), {
    dir: BaseDirectory.App,
  });
};

// Function to check if a path exists
const pathExists = async (path: string, baseDir?: BaseDirectory) => {
  const exists: boolean = await fs.exists(path, { dir: baseDir });
  return exists;
};

// Object containing various actions to be performed
export const actions = {
  // Action to initialize the application
  init: async () => {
    const text = await fs
      .readTextFile("app.json", { dir: BaseDirectory.App })
      .catch((error) => {
        console.error(error);
        return "{}";
      });
    const appData: Partial<AppData> = JSON.parse(text);

    if (appData.folders) {
      setState("app", "folders", appData.folders);
    }
    setState("ready", true); // Mark the application as ready
  },

  // Action to set the selected folder
  setFolder: (folder: string | null) => {
    setState("folder", folder);
  },

  // Action to remove a folder from history
  removeFolderFromHistory: async (folder: string) => {
    setState(
      "app",
      "folders",
      state.app.folders.filter((f) => f !== folder)
    );
    await writeAppJson(state.app);
  },

  // Continuing with the 'actions' object containing various actions

  // Action to load a selected folder and its snippets
  loadFolder: async (folder: string) => {
    const exists = await pathExists(folder);

    // Check if the selected folder exists
    if (!exists) {
      // If the folder doesn't exist, remove it from the history and show an error message
      setState(
        "app",
        "folders",
        state.app.folders.filter((f) => f !== folder)
      );
      await writeAppJson(state.app);
      await dialog.message("A 'Workspace' folder doesn't exist");
      return;
    }

    // Get the path to the "snippets.json" file inside the selected folder
    const snippetsPath = await path.join(folder, "snippets.json");

    // Read the contents of "snippets.json" file
    const text = await fs.readTextFile(snippetsPath).catch((error) => {
      console.error(error);
      return null;
    });

    if (text) {
      // If the file exists and is not empty, parse the JSON data and update the snippets state
      const snippets = JSON.parse(text);
      setState("snippets", snippets);
    } else {
      // If the file is empty or doesn't exist, set the snippets state to an empty array
      setState("snippets", []);
    }

    // Update the history of selected folders based on the user's choice
    if (state.app.folders.includes(folder)) {
      setState("app", "folders", [
        folder,
        ...state.app.folders.filter((f) => f !== folder),
      ]);
    } else {
      setState("app", "folders", [folder, ...state.app.folders.slice(0, 10)]);
    }

    // Write the updated application data to "app.json" file
    await writeAppJson(state.app);
  },

  // Action to create a new snippet
  createSnippet: async (snippet: Snippet, content: string) => {
    if (!state.folder) return;

    // Generate a unique ID for the new snippet
    const snippetId = actions.getRandomId();

    // Get the filepath where the snippet content will be saved
    const filepath = await path.join(state.folder, snippetId);

    // Write the snippet content to the file
    await fs.writeTextFile(filepath, content);

    // Update the snippets state with the new snippet
    const snippets = [...state.snippets, { ...snippet, id: snippetId }];
    await writeSnippetsJson(state.folder, snippets);
    setState("snippets", snippets);
  },

  // Action to get a random ID for a snippet
  getRandomId: () => {
    return nanoid(10);
  },

  // Action to read the content of a snippet given its ID
  readSnippetContent: async (id: string) => {
    if (!state.folder) return "";

    // Get the filepath of the snippet based on its ID
    const filepath = await path.join(state.folder, id);

    // Read the content of the snippet from the file
    const text = await fs.readTextFile(filepath);
    return text;
  },

  // Action to update a snippet's property value
  updateSnippet: async <K extends keyof Snippet, V extends Snippet[K]>(
    id: string,
    key: K,
    value: V
  ) => {
    if (!state.folder) return;

    // Update the specified property of the snippet with the new value
    const snippets = state.snippets.map((snippet) => {
      if (snippet.id === id) {
        return {
          ...snippet,
          [key]: value,
          updatedAt: new Date().toISOString(),
        };
      }
      return snippet;
    });

    // Update the snippets state with the updated snippet
    setState("snippets", snippets);

    // Write the updated snippets data to "snippets.json" file
    await writeSnippetsJson(state.folder, snippets);

    // Call the 'syncSnippetsToVscode' action to synchronize the snippets with VSCode
    await actions.syncSnippetsToVscode();
  },

  // Action to update a snippet's content
  updateSnippetContent: async (id: string, content: string) => {
    if (!state.folder) return;

    // Get the filepath of the snippet based on its ID
    const filepath = await path.join(state.folder, id);

    // Write the new content to the snippet file
    await fs.writeTextFile(filepath, content);

    // Update the 'updatedAt' property of the snippet
    await actions.updateSnippet(id, "updatedAt", new Date().toISOString());
  },

  // Continuing with the 'actions' object containing various actions

  // Action to move snippets to trash or restore them
  moveSnippetsToTrash: async (ids: string[], restore = false) => {
    if (!state.folder) return;

    // Update the 'deletedAt' property of the specified snippets to move them to trash or restore them
    const snippets = state.snippets.map((snippet) => {
      if (ids.includes(snippet.id)) {
        return {
          ...snippet,
          deletedAt: restore ? undefined : new Date().toISOString(),
        };
      }
      return snippet;
    });

    // Update the snippets state with the updated snippets
    setState("snippets", snippets);

    // Write the updated snippets data to "snippets.json" file
    await writeSnippetsJson(state.folder, snippets);

    // Call the 'syncSnippetsToVscode' action to synchronize the snippets with VSCode
    await actions.syncSnippetsToVscode();
  },

  // Action to delete a snippet permanently
  deleteSnippetForever: async (id: string) => {
    if (!state.folder) return;

    // Filter out the snippet with the specified ID from the snippets state
    const snippets = state.snippets.filter((snippet) => snippet.id !== id);

    // Update the snippets state with the filtered snippets
    setState("snippets", snippets);

    // Write the updated snippets data to "snippets.json" file
    await writeSnippetsJson(state.folder, snippets);

    // Delete the snippet file permanently from the folder
    await fs.removeFile(await path.join(state.folder, id));
  },

  // Action to empty the trash and delete snippets permanently
  emptyTrash: async () => {
    if (!state.folder) return;

    const toDelete: string[] = [];

    // Filter out the snippets with 'deletedAt' property set (i.e., in trash)
    const snippets = state.snippets.filter((snippet) => {
      if (snippet.deletedAt) {
        toDelete.push(snippet.id);
      }
      return !snippet.deletedAt;
    });

    // Update the snippets state with the filtered snippets
    setState("snippets", snippets);

    // Write the updated snippets data to "snippets.json" file
    await writeSnippetsJson(state.folder, snippets);

    // Delete the snippets permanently from the folder
    await Promise.all(
      toDelete.map(async (id) => {
        return fs.removeFile(await path.join(state.folder!, id));
      })
    );
  },

  // Continuing with the 'actions' object containing various actions

  // Action to get the folder history from "folders.json" file
  getFolderHistory: async () => {
    const text = await fs
      .readTextFile("folders.json", { dir: BaseDirectory.App })
      .catch(() => "[]");
    const folders: string[] = JSON.parse(text);
    return folders;
  },

  // Action to synchronize snippets with Visual Studio Code (VSCode)
  syncSnippetsToVscode: async () => {
    if (!state.folder) return;

    // Get the name of the current folder from the selected folder path
    const folderName = state.folder.split(path.sep).pop()!;

    // Type definition for VSCode snippets
    type VSCodeSnippets = Record<
      string,
      { scope: string; prefix: string[]; body: string[]; __folderName: string }
    >;

    // Object to store new snippets data to be synchronized with VSCode
    const newSnippets: VSCodeSnippets = {};

    // Iterate through snippets to build new snippets data
    for (const s of state.snippets) {
      const prefix = s.vscodeSnippet?.prefix?.trim();

      // Exclude snippets with no prefix or those that are marked as deleted (in trash)
      if (!prefix || s.deletedAt) {
        continue;
      }

      // Construct the new snippet data
      newSnippets[s.name] = {
        scope: "",
        prefix: prefix
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        body: [await actions.readSnippetContent(s.id)],
        __folderName: folderName,
      };
    }

    // File and directory information for VSCode snippets
    const snippetsFileName = "gamenotebook.code-snippets";
    const codeSnippetsDir = `Code${path.sep}User${path.sep}snippets`;
    const snippetsFilePath = `${codeSnippetsDir}${path.sep}${snippetsFileName}`;

    // Check if VSCode is installed (based on the presence of "Code" directory in user's data directory)
    if (!(await pathExists("Code", BaseDirectory.Data))) {
      return; // VSCode is not installed, so exit the action
    }

    // Get existing snippets from the VSCode snippets file, if it exists
    const snippets: VSCodeSnippets = (await pathExists(
      snippetsFilePath,
      BaseDirectory.Data
    ))
      ? JSON.parse(
          await fs.readTextFile(snippetsFilePath, { dir: BaseDirectory.Data })
        )
      : {};

    // Merge old and new snippets, remove existing snippets from the same folder
    for (const name in snippets) {
      const snippet = snippets[name];
      if (snippet.__folderName === folderName) {
        delete snippets[name];
      }
    }
    Object.assign(snippets, newSnippets);

    // Write the updated snippets data to the VSCode snippets file
    console.log("writing", snippetsFilePath);
    await fs.createDir(codeSnippetsDir, {
      recursive: true,
      dir: BaseDirectory.Data,
    });
    await fs.writeTextFile(
      snippetsFilePath,
      JSON.stringify(snippets, null, 2),
      { dir: BaseDirectory.Data }
    );
  },
};
