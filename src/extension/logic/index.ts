import * as browser from "webextension-polyfill";

export * from "./storage";

export class PermissionsError extends Error {
  readonly code = "error_add_permissions";

  constructor(readonly perms: browser.Permissions.Permissions, public readonly reload = false, public readonly reason?: string) {
    super();
  }
}