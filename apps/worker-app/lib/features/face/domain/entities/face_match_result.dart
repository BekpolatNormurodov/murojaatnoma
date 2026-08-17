class FaceMatchResult {
  const FaceMatchResult(this.similarity, {required this.passed});
  final double similarity;
  final bool passed;
}
