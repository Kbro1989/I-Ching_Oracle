export class TernaryRouter {
  public getCurrentTemporalMode(): 'PAST' | 'PRESENT' | 'FUTURE' {
    return 'PRESENT';
  }
  public getPolarity(): number {
    return 1.0;
  }
}
