export type ServiceKeyTemplate = {
  id: string;
  label: string;
  description: string;
  defaultHost?: string;
  defaultUser?: string;
  docsUrl?: string;
};

export const SERVICE_KEY_TEMPLATES: ServiceKeyTemplate[] = [
  {
    id: "github",
    label: "GitHub",
    description: "Git operations over SSH",
    defaultHost: "github.com",
    defaultUser: "git",
    docsUrl: "https://github.com/settings/keys",
  },
  {
    id: "gitlab",
    label: "GitLab",
    description: "Git operations over SSH",
    defaultHost: "gitlab.com",
    defaultUser: "git",
    docsUrl: "https://gitlab.com/-/user_settings/ssh_keys",
  },
  {
    id: "bitbucket",
    label: "Bitbucket Cloud",
    description: "Git operations over SSH",
    defaultHost: "bitbucket.org",
    defaultUser: "git",
    docsUrl: "https://bitbucket.org/account/settings/ssh-keys/",
  },
  {
    id: "azure-devops",
    label: "Azure DevOps",
    description: "Azure Repos over SSH",
    defaultHost: "ssh.dev.azure.com",
    defaultUser: "git",
    docsUrl: "https://learn.microsoft.com/azure/devops/repos/git/use-ssh-keys-to-authenticate",
  },
  {
    id: "codeberg",
    label: "Codeberg",
    description: "Git operations over SSH",
    defaultHost: "codeberg.org",
    defaultUser: "git",
    docsUrl: "https://codeberg.org/user/settings/keys",
  },
  {
    id: "custom",
    label: "Custom SSH Service",
    description: "Any SSH-capable service or self-hosted Git",
  },
];

export function getServiceKeyTemplate(id: string): ServiceKeyTemplate | undefined {
  return SERVICE_KEY_TEMPLATES.find((template) => template.id === id);
}
