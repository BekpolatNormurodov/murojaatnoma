// image_picker platform interfeysi faqat testda soxtalashtiriladi.
// ignore_for_file: depend_on_referenced_packages
import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';
import 'package:user_app/features/requests/presentation/pages/submit_request_page.dart';
import 'package:user_app/features/requests/presentation/widgets/request_attachment_picker.dart';

import '../../support/fonts.dart';
import '../../support/small_screen.dart';

class _Submit extends MockCubit<SubmitRequestState>
    implements SubmitRequestCubit {}

class _HugeFile extends XFile {
  _HugeFile() : super('/huge.gif');

  @override
  Future<int> length() async => RequestAttachmentPicker.maxFileBytes + 1;
}

class _Picker extends ImagePickerPlatform {
  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async => _HugeFile();
}

void main() {
  setUpAll(loadTestFonts);

  testWidgets('Send brings the first invalid field into view', (tester) async {
    useSmallScreen(tester);
    final cubit = _Submit();
    when(cubit.loadDefaultLocation).thenAnswer((_) async => null);
    when(() => cubit.state).thenReturn(const SubmitRequestIdle());
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(
      localizedApp(
        BlocProvider<SubmitRequestCubit>.value(
          value: cubit,
          child: const SubmitRequestPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final send = find.text(l10n.createRequestSubmit);
    await tester.scrollUntilVisible(
      send,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(send);
    await tester.pumpAndSettle();

    await tester.tap(send);
    await tester.pumpAndSettle();

    final title = tester.getRect(find.text(l10n.createRequestTitleLabel));
    expect(title.top, greaterThan(0));
    expect(title.bottom, lessThan(640));
    await drainFonts(tester);
  });

  testWidgets('a file over the server limit is not attached', (tester) async {
    final previous = ImagePickerPlatform.instance;
    ImagePickerPlatform.instance = _Picker();
    addTearDown(() => ImagePickerPlatform.instance = previous);
    final changes = <List<RequestAttachment>>[];
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(
      localizedApp(
        Scaffold(
          body: RequestAttachmentPicker(
            attachments: const [],
            onChanged: changes.add,
          ),
        ),
      ),
    );

    await tester.tap(find.text(l10n.attachmentAddImage));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.attachmentGallery));
    await tester.pumpAndSettle();

    expect(changes, isEmpty);
    expect(find.textContaining('25 MB'), findsOneWidget);
    await tester.pumpAndSettle(const Duration(seconds: 6));
    await drainFonts(tester);
  });
}
