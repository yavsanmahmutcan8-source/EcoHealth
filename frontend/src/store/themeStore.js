import { create } from 'zustand';

const getInitialTheme = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedPrefs = window.localStorage.getItem('color-theme');
    if (typeof storedPrefs === 'string') {
      return storedPrefs;
    }
    const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
    if (userMedia.matches) {
      return 'dark';
    }
  }
  return 'light'; // default theme
};

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('color-theme', newTheme);
      if (newTheme === 'dark') {
         document.documentElement.setAttribute('data-theme', 'dark');
      } else {
         document.documentElement.removeAttribute('data-theme');
      }
    }
    return { theme: newTheme };
  }),
  initTheme: () => set((state) => {
      // Called once on App mount to apply initial state to HTML element
      if (state.theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
      } else {
          document.documentElement.removeAttribute('data-theme');
      }
      return state;
  })
}));
