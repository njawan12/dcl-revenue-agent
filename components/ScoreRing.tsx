export function ScoreRing({ score }: { score: number }) {
  return <div className={`score ${score >= 90 ? 'hot' : score >= 80 ? 'warm' : ''}`}>{score}</div>
}
