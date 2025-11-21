import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutomatizacionesComponent } from './automatizaciones.component';

describe('AutomatizacionesComponent', () => {
  let component: AutomatizacionesComponent;
  let fixture: ComponentFixture<AutomatizacionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutomatizacionesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AutomatizacionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
