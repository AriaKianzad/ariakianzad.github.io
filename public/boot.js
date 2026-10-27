/*
 * Runs before first paint: confirms scripting and unlocks enhancement-only
 * CSS (the menu trigger, scroll reveals, the accent underline animation).
 * Without this attribute, every element stays fully visible and styled.
 */
document.documentElement.setAttribute("data-js", "");
