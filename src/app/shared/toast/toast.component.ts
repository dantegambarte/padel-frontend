import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { ToastService, ToastMessage } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private sub = new Subscription();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub.add(
      this.toastService.toasts$.subscribe((toasts) => {
        this.toasts = toasts;
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  toastClass(variant: ToastMessage['variant']): string {
    const base =
      'flex items-start gap-3 rounded-lg border p-4 shadow-lg ' +
      'animate-in slide-in-from-right-full duration-300';
    const variants: Record<ToastMessage['variant'], string> = {
      default:     `${base} border-border bg-card text-card-foreground`,
      success:     `${base} border-accent/40 bg-accent/10 text-accent-foreground`,
      destructive: `${base} border-destructive/40 bg-destructive/10 text-destructive`,
    };
    return variants[variant];
  }
}
