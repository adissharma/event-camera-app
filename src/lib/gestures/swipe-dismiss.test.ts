import { swipeDismissDirection } from './swipe-dismiss';

const thresholds = { distance: 100, flickDistance: 50, flickVelocity: 0.5 };

describe('swipeDismissDirection', () => {
  it('dismisses a long drag in either direction', () => {
    expect(swipeDismissDirection(120, 0, thresholds)).toBe(1);
    expect(swipeDismissDirection(-120, 0, thresholds)).toBe(-1);
  });

  it('dismisses a shorter flick in either direction', () => {
    expect(swipeDismissDirection(60, 0.8, thresholds)).toBe(1);
    expect(swipeDismissDirection(-60, -0.8, thresholds)).toBe(-1);
  });

  it('settles back from a short, slow drag', () => {
    expect(swipeDismissDirection(60, 0.1, thresholds)).toBe(0);
    expect(swipeDismissDirection(-60, -0.1, thresholds)).toBe(0);
  });

  it('settles back from a flick that has barely moved', () => {
    expect(swipeDismissDirection(20, 3, thresholds)).toBe(0);
    expect(swipeDismissDirection(-20, -3, thresholds)).toBe(0);
  });

  it('treats a flick back against the drag as changing their mind', () => {
    expect(swipeDismissDirection(60, -0.8, thresholds)).toBe(0);
    expect(swipeDismissDirection(-60, 0.8, thresholds)).toBe(0);
  });

  it('settles back when nothing moved', () => {
    expect(swipeDismissDirection(0, 0, thresholds)).toBe(0);
  });
});
