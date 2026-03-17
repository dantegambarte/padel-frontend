import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ProductsRoutingModule } from './products-routing.module';
import { ProductsComponent } from './products.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [ProductsComponent],
  imports: [CommonModule, FormsModule, ProductsRoutingModule, SharedModule],
})
export class ProductsModule {}
