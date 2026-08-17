enum LivenessAction { blink, turnLeft, turnRight, smile }

class FaceSignal {
  const FaceSignal({
    this.leftEye,
    this.rightEye,
    this.headEulerY,
    this.smile,
  });

  final double? leftEye;
  final double? rightEye;
  final double? headEulerY;
  final double? smile;
}
