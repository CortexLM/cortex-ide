export interface IconDefinition {
  icon: string;
  color: string;
}

export interface IconTheme {
  id: string;
  name: string;
  description: string;
  icons: {
    file: IconDefinition;
    folder: IconDefinition;
    folderOpen: IconDefinition;
    fileExtensions: Record<string, IconDefinition>;
    fileNames: Record<string, IconDefinition>;
    folderNames: Record<string, IconDefinition>;
    folderNamesOpen: Record<string, IconDefinition>;
  };
}

export interface IconThemeState {
  activeThemeId: string;
}

export interface IconThemeContextValue {
  activeTheme: () => IconTheme;
  themes: () => IconTheme[];
  setIconTheme: (id: string) => void;
  getFileIcon: (filename: string) => IconDefinition;
  getFolderIcon: (name: string, open: boolean) => IconDefinition;
  registerTheme: (theme: IconTheme) => void;
  setFileAssociation: (pattern: string, icon: IconDefinition) => void;
  removeFileAssociation: (pattern: string) => void;
  customAssociations: () => Record<string, IconDefinition>;
  loadThemeFromJSON: (json: string) => IconTheme | null;
}
