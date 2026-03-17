import { Component } from '@angular/core';

/**
 * Root component of the application.
 * Hosts the primary router outlet, the global toast overlay, and the calculator widget.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'padel-frontend';
}
