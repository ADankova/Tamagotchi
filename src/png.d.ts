// Картинки импортируются как адреса (Vite кладёт их в сборку).
declare module '*.png' {
  const url: string;
  export default url;
}
