import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InduccionComponent } from './induccion.component';

describe('InduccionComponent', () => {
  let component: InduccionComponent;
  let fixture: ComponentFixture<InduccionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InduccionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InduccionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
