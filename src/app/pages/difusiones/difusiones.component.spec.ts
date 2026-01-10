import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DifusionesComponent } from './difusiones.component';

describe('DifusionesComponent', () => {
  let component: DifusionesComponent;
  let fixture: ComponentFixture<DifusionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DifusionesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DifusionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
