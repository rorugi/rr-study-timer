// LearningStatsBody places the entire plugin outlet in one grid child.
// Scope the fix to that outlet containing our plugin, including native hosts.
export const statisticsHostCSS = `
.grid-cols-2 > div:has(> .fade-in-first-load .rn-plugin-root[data-plugin-id="rr-study-timer"]) {
  grid-column: 1 / -1;
  min-width: 0;
}
`;
