type Listener<T> = (event: T) => void;

class MockEventEmitter<T> {
  private readonly listeners: Listener<T>[] = [];

  public readonly event = (listener: Listener<T>) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      }
    };
  };

  public fire(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

class MockTreeItem {
  public label: string;
  public collapsibleState: number;

  public constructor(label: string, collapsibleState: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

class MockThemeIcon {
  public readonly id: string;

  public constructor(id: string) {
    this.id = id;
  }
}

type UpdateCall = {
  key: string;
  value: unknown;
  target: unknown;
};

const configurationValues = new Map<string, unknown>();
const updateCalls: UpdateCall[] = [];
const shownErrors: string[] = [];
let workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined = [
  { uri: { fsPath: process.cwd() } }
];

export const ConfigurationTarget = {
  Global: 'global',
  Workspace: 'workspace'
} as const;

export const TreeItemCollapsibleState = {
  None: 0
} as const;

export const workspace = {
  get name() {
    const firstFolder = workspaceFolders?.[0]?.uri.fsPath;
    return firstFolder ? firstFolder.split('/').filter(Boolean).pop() : undefined;
  },
  get workspaceFile() {
    return undefined;
  },
  get workspaceFolders() {
    return workspaceFolders;
  },
  getConfiguration: () => ({
    get<T>(key: string, defaultValue: T): T {
      return (configurationValues.has(key) ? configurationValues.get(key) : defaultValue) as T;
    },
    async update(key: string, value: unknown, target: unknown): Promise<void> {
      configurationValues.set(key, value);
      updateCalls.push({ key, value, target });
    }
  })
};

export const window = {
  async showErrorMessage(message: string): Promise<void> {
    shownErrors.push(message);
  },
  async showInformationMessage(_message: string): Promise<void> {},
  async showWarningMessage(_message: string): Promise<void> {}
};

export function createSecretStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async store(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async get(key: string): Promise<string | undefined> {
      return store.get(key);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    }
  };
}

export function resetVscodeMock(): void {
  configurationValues.clear();
  updateCalls.length = 0;
  shownErrors.length = 0;
  workspaceFolders = [{ uri: { fsPath: process.cwd() } }];
}

export function setConfiguration(values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    configurationValues.set(key, value);
  }
}

export function setWorkspaceFolders(folders: Array<{ uri: { fsPath: string } }> | undefined): void {
  workspaceFolders = folders;
}

export function getUpdateCalls(): UpdateCall[] {
  return [...updateCalls];
}

export function getShownErrors(): string[] {
  return [...shownErrors];
}

export function createVscodeModule() {
  return {
    EventEmitter: MockEventEmitter,
    TreeItem: MockTreeItem,
    ThemeIcon: MockThemeIcon,
    TreeItemCollapsibleState,
    ConfigurationTarget,
    workspace,
    window
  };
}
