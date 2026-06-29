import { EventEmitter, Injectable } from '@angular/core';

export type UtilityAction = 'calculator' | 'pdf' | 'excel' | 'print';

/** Decouples the sidebar/topbar utility buttons from the layout handler. */
@Injectable({ providedIn: 'root' })
export class UtilityBus extends EventEmitter<UtilityAction> {}
