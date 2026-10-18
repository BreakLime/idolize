// Navigation for code outside React components (menus, commands). The router registers itself here.
type Nav = (to: string | number) => void;
let nav: Nav | null = null;

export const setNavigator = (n: Nav) => {
  nav = n;
};
export const navigate = (to: string | number) => nav?.(to);
