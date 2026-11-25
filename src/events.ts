type Handler<E> = (event: E) => void;

/** Типизированная шина событий: подписка по полю type получает событие нужного вида. */
export class EventBus<E extends { type: string }> {
  private handlers = new Map<E['type'], Set<Handler<E>>>();
  private anyHandlers = new Set<Handler<E>>();

  on<T extends E['type']>(type: T, handler: Handler<Extract<E, { type: T }>>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const h = handler as Handler<E>;
    set.add(h);
    return () => set.delete(h);
  }

  onAny(handler: Handler<E>): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit(event: E): void {
    this.handlers.get(event.type)?.forEach((h) => h(event));
    this.anyHandlers.forEach((h) => h(event));
  }
}
