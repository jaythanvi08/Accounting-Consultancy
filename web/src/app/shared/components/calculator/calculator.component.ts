import { ChangeDetectionStrategy, Component, HostListener, OnInit, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface HistoryEntry {
  expr: string;
  result: string;
  timestamp: string;
}

/** Floating calculator: standard, scientific, GST modes + history. */
@Component({
  selector: 'app-calculator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule],
  template: `
    <div class="calc-panel">
      <!-- Header with mode tabs -->
      <div class="calc-head">
        <div class="calc-tabs">
          <button
            class="calc-tab"
            [class.active]="mode() === 'standard'"
            (click)="mode.set('standard')"
            title="Standard Calculator"
          >
            <i class="bi bi-calculator"></i>
          </button>
          <button
            class="calc-tab"
            [class.active]="mode() === 'scientific'"
            (click)="mode.set('scientific')"
            title="Scientific Mode"
          >
            <i class="bi bi-graph-up"></i>
          </button>
          <button
            class="calc-tab"
            [class.active]="mode() === 'gst'"
            (click)="mode.set('gst')"
            title="GST Calculator"
          >
            GST
          </button>
        </div>
        <button class="calc-close" (click)="closed.emit()" aria-label="Close"><i class="bi bi-x-lg"></i></button>
      </div>

      <!-- Display -->
      <div class="calc-display">
        <div class="calc-expr">{{ expression() || ' ' }}</div>
        <div class="calc-value">{{ display() }}</div>
        @if (mode() === 'gst' && gstAmount && gstAmount > 0) {
          <div class="calc-gst-out">
            <small>CGST: ₹{{ gstCGST() | number: '1.2-2' }} | SGST: ₹{{ gstSGST() | number: '1.2-2' }}</small>
          </div>
        }
      </div>

      <!-- Standard / Scientific Grid -->
      @if (mode() !== 'gst') {
        <div class="calc-grid" [class.scientific]="mode() === 'scientific'">
          @if (mode() === 'scientific') {
            <button class="calc-btn fn" (click)="sin()">sin</button>
            <button class="calc-btn fn" (click)="cos()">cos</button>
            <button class="calc-btn fn" (click)="tan()">tan</button>
            <button class="calc-btn fn" (click)="sqrt()">√</button>
            <button class="calc-btn fn" (click)="pow()">x²</button>
            <button class="calc-btn fn" (click)="pi()">π</button>
            <button class="calc-btn fn" (click)="log()">log</button>
            <button class="calc-btn fn" (click)="ln()">ln</button>
          }

          <button class="calc-btn fn" (click)="clear()">C</button>
          <button class="calc-btn fn" (click)="backspace()"><i class="bi bi-backspace"></i></button>
          <button class="calc-btn fn" (click)="percent()">%</button>
          <button class="calc-btn op" (click)="op('/')">÷</button>

          @for (row of numRows; track row[0]) {
            @for (key of row; track key) {
              <button
                class="calc-btn"
                [class.op]="isOp(key)"
                [class.zero]="key === '0'"
                (click)="press(key)"
              >{{ key }}</button>
            }
          }
          <button class="calc-btn equals" (click)="equals()">=</button>
        </div>
      }

      <!-- GST Calculator -->
      @if (mode() === 'gst') {
        <div class="gst-form">
          <div class="gst-field">
            <label>Amount (excl. GST)</label>
            <input type="number" [(ngModel)]="gstAmount" placeholder="0.00" class="form-control form-control-sm" (keyup.enter)="calculateGST()" />
          </div>
          <div class="gst-field">
            <label>GST Rate (%)</label>
            <select [(ngModel)]="gstRate" class="form-control form-control-sm" (change)="calculateGST()">
              <option value="5">5%</option>
              <option value="9">9%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>
          <button class="btn btn-sm w-100 mt-2" style="background: var(--accent); color: #fff; border: none;" (click)="calculateGST()">Calculate</button>
          @if (gstAmount && gstAmount > 0) {
            <div class="gst-output">
              <div class="gst-line">CGST ({{ gstRate / 2 }}%): <span class="amt">₹{{ gstCGST() | number: '1.2-2' }}</span></div>
              <div class="gst-line">SGST ({{ gstRate / 2 }}%): <span class="amt">₹{{ gstSGST() | number: '1.2-2' }}</span></div>
              <div class="gst-line gst-total">Total GST: <span class="amt">₹{{ gstCGST() + gstSGST() | number: '1.2-2' }}</span></div>
              <div class="gst-line gst-final">Total (incl. GST): <span class="amt">₹{{ (gstAmount || 0) + (gstCGST() + gstSGST()) | number: '1.2-2' }}</span></div>
            </div>
          }
        </div>
      }

      <!-- History -->
      @if (history().length > 0) {
        <div class="calc-hist">
          <div class="calc-hist-title">History (recent 10)</div>
          <div class="calc-hist-list">
            @for (entry of history(); track entry.timestamp) {
              <div class="calc-hist-item" (click)="restoreHistory(entry)">
                <span class="hist-expr">{{ entry.expr }}</span>
                <span class="hist-result">{{ entry.result }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .calc-panel { background: #fff; border-radius: var(--radius-sm); box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; max-width: 420px; }
      .calc-head { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--primary); }
      .calc-tabs { display: flex; gap: 0; }
      .calc-tab { background: transparent; border: none; color: rgba(255,255,255,0.6); padding: 0.4rem 0.6rem; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; font-weight: 600; }
      .calc-tab.active { color: #fff; background: rgba(255,255,255,0.15); border-radius: var(--radius-sm); }
      .calc-close { background: transparent; border: none; color: #fff; cursor: pointer; padding: 0.4rem; }

      .calc-display { padding: 0.85rem 1rem; text-align: right; background: #0f2238; color: #fff; }
      .calc-expr { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); min-height: 1rem; }
      .calc-value { font-family: var(--font-mono); font-size: 1.8rem; font-weight: 700; }
      .calc-gst-out { font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent); margin-top: 0.3rem; }

      .calc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); padding: 1px; }
      .calc-grid.scientific { grid-template-columns: repeat(4, 1fr); }
      .calc-btn { border: none; background: var(--card-bg); padding: 0.75rem 0; font-family: var(--font-mono); font-size: 0.95rem; cursor: pointer; transition: background 0.1s; }
      .calc-btn:active { background: var(--surface); }
      .calc-btn.op { background: rgba(200,134,10,0.15); color: var(--accent); font-weight: 600; }
      .calc-btn.fn { background: var(--surface); color: var(--text-secondary); font-size: 0.8rem; font-weight: 600; }
      .calc-btn.zero { grid-column: span 2; }
      .calc-btn.equals { grid-column: span 4; background: var(--accent); color: #fff; font-weight: 700; padding: 0.85rem; }

      .gst-form { padding: 1rem; }
      .gst-field { margin-bottom: 0.75rem; }
      .gst-field label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.3rem; color: var(--text-secondary); }
      .gst-output { margin-top: 1rem; padding: 0.75rem; background: var(--surface); border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.85rem; }
      .gst-line { display: flex; justify-content: space-between; padding: 0.3rem 0; }
      .gst-line .amt { font-weight: 600; }
      .gst-total { border-top: 1px solid var(--border); margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 600; }
      .gst-final { color: var(--primary); border-top: 2px solid var(--primary); margin-top: 0.3rem; padding-top: 0.3rem; font-weight: 700; }

      .calc-hist { border-top: 1px solid var(--border); padding: 0.75rem 1rem; max-height: 180px; overflow-y: auto; }
      .calc-hist-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 0.5rem; }
      .calc-hist-list { }
      .calc-hist-item { display: flex; justify-content: space-between; padding: 0.4rem; font-family: var(--font-mono); font-size: 0.8rem; cursor: pointer; transition: background 0.1s; border-radius: 2px; }
      .calc-hist-item:hover { background: var(--surface); }
      .hist-expr { color: var(--text-secondary); }
      .hist-result { font-weight: 600; color: var(--primary); }
    `
  ]
})
export class CalculatorComponent implements OnInit {
  readonly closed = output<void>();

  readonly mode = signal<'standard' | 'scientific' | 'gst'>('standard');
  readonly display = signal('0');
  readonly expression = signal('');
  readonly history = signal<HistoryEntry[]>([]);

  readonly numRows: ReadonlyArray<ReadonlyArray<string>> = [
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.']
  ];

  gstAmount = 0;
  gstRate = 18;
  readonly gstCGST = signal(0);
  readonly gstSGST = signal(0);

  private current = '0';
  private previous: number | null = null;
  private operator: string | null = null;
  private resetNext = false;

  ngOnInit(): void {
    this.loadHistory();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (this.mode() === 'gst') return;
    const key = event.key;
    if (/\d/.test(key) || key === '.') {
      event.preventDefault();
      this.input(key);
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
      event.preventDefault();
      this.op(key);
    } else if (key === 'Enter' || key === '=') {
      event.preventDefault();
      this.equals();
    } else if (key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
      event.preventDefault();
      this.clear();
    }
  }

  isOp(key: string): boolean {
    return ['+', '-', '*', '/'].includes(key);
  }

  press(key: string): void {
    this.isOp(key) ? this.op(key) : this.input(key);
  }

  private input(d: string): void {
    if (this.resetNext) {
      this.current = '0';
      this.resetNext = false;
    }
    if (d === '.') {
      if (!this.current.includes('.')) {
        this.current += '.';
      }
    } else {
      this.current = this.current === '0' ? d : this.current + d;
    }
    this.display.set(this.current);
  }

  op(o: string): void {
    if (this.operator && !this.resetNext) {
      this.equals();
    }
    this.previous = parseFloat(this.current);
    this.operator = o;
    this.resetNext = true;
    this.expression.set(`${this.previous} ${this.symbolOf(o)}`);
  }

  equals(): void {
    if (this.operator === null || this.previous === null) return;
    const curr = parseFloat(this.current);
    const result = this.compute(this.previous, curr, this.operator);
    const expr = `${this.previous} ${this.symbolOf(this.operator)} ${curr}`;
    this.addToHistory(expr, this.trim(result));
    this.expression.set(`${expr} =`);
    this.current = this.trim(result);
    this.display.set(this.current);
    this.operator = null;
    this.previous = null;
    this.resetNext = true;
  }

  percent(): void {
    this.current = this.trim(parseFloat(this.current) / 100);
    this.display.set(this.current);
  }

  sin(): void {
    this.scientificFunc('sin', Math.sin(Number(this.current) * (Math.PI / 180)));
  }
  cos(): void {
    this.scientificFunc('cos', Math.cos(Number(this.current) * (Math.PI / 180)));
  }
  tan(): void {
    this.scientificFunc('tan', Math.tan(Number(this.current) * (Math.PI / 180)));
  }
  sqrt(): void {
    this.scientificFunc('√', Math.sqrt(Number(this.current)));
  }
  pow(): void {
    this.scientificFunc('x²', Math.pow(Number(this.current), 2));
  }
  pi(): void {
    this.current = this.trim(Math.PI);
    this.display.set(this.current);
  }
  log(): void {
    this.scientificFunc('log', Math.log10(Number(this.current)));
  }
  ln(): void {
    this.scientificFunc('ln', Math.log(Number(this.current)));
  }

  private scientificFunc(label: string, result: number): void {
    this.addToHistory(`${label}(${this.current})`, this.trim(result));
    this.current = this.trim(result);
    this.display.set(this.current);
    this.expression.set(label);
  }

  calculateGST(): void {
    if (this.gstAmount <= 0) return;
    const gstTotal = this.gstAmount * (this.gstRate / 100);
    const cgst = gstTotal / 2;
    const sgst = gstTotal / 2;
    this.gstCGST.set(cgst);
    this.gstSGST.set(sgst);
    const expr = `GST ${this.gstRate}% on ₹${this.gstAmount}`;
    const result = `CGST: ₹${cgst.toFixed(2)} | SGST: ₹${sgst.toFixed(2)}`;
    this.addToHistory(expr, result);
  }

  clear(): void {
    this.current = '0';
    this.previous = null;
    this.operator = null;
    this.resetNext = false;
    this.expression.set('');
    this.display.set('0');
  }

  backspace(): void {
    this.current = this.current.length > 1 ? this.current.slice(0, -1) : '0';
    this.display.set(this.current);
  }

  private compute(a: number, b: number, o: string): number {
    switch (o) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? 0 : a / b;
      default: return b;
    }
  }

  private symbolOf(o: string): string {
    return o === '*' ? '×' : o === '/' ? '÷' : o;
  }

  private trim(n: number): string {
    return parseFloat(n.toFixed(6)).toString();
  }

  private addToHistory(expr: string, result: string): void {
    const entries = [...this.history()];
    entries.unshift({ expr, result, timestamp: new Date().toISOString() });
    this.history.set(entries.slice(0, 10));
    this.saveHistory();
  }

  private saveHistory(): void {
    localStorage.setItem('ledgerai.calc.history', JSON.stringify(this.history()));
  }

  private loadHistory(): void {
    const saved = localStorage.getItem('ledgerai.calc.history');
    if (saved) {
      try {
        this.history.set(JSON.parse(saved).slice(0, 10));
      } catch {}
    }
  }

  restoreHistory(entry: HistoryEntry): void {
    this.display.set(entry.result);
    this.expression.set(entry.expr);
    this.current = entry.result;
    this.resetNext = true;
  }
}
