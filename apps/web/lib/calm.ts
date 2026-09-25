const KEY = "quad:calm";

export function readCalm(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCalm(on: boolean) {
  document.documentElement.classList.toggle("calm", on);
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private mode or blocked storage: calm mode just won't persist.
  }
}

/** Runs before paint so calm mode never flashes the full-motion UI. */
export const calmBootScript = `try{if(localStorage.getItem("${KEY}")==="1")document.documentElement.classList.add("calm")}catch(e){}`;
