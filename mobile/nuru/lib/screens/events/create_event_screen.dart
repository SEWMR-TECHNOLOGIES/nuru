
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';
import '../../core/services/events_service.dart';
import '../../core/services/ticketing_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/amount_input.dart';
import '../../core/widgets/agreement_gate.dart';
import 'event_detail_screen.dart';
import 'map_picker_screen.dart';
import 'widgets/ticket_class_form.dart';
import 'widgets/event_ticketing_card.dart';
import 'widgets/event_recommendations_card.dart';
import 'widgets/card_template_picker.dart';
import '../../core/l10n/l10n_helper.dart';

class CreateEventScreen extends StatefulWidget {
  final Map<String, dynamic>? editEvent;
  const CreateEventScreen({super.key, this.editEvent});

  @override
  State<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends State<CreateEventScreen> {
  static const int _maxCoverImageBytes = 5 * 1024 * 1024;

  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _venueCtrl = TextEditingController();
  final _expectedGuestsCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController();
  final _dressCodeCtrl = TextEditingController();
  final _specialInstructionsCtrl = TextEditingController();
  final _reminderContactPhoneCtrl = TextEditingController();
  String? _eventTypeId;
  String _visibility = 'private';
  DateTime? _startDate;
  DateTime? _endDate;
  TimeOfDay? _startTime;
  bool _sellsTickets = false;
  bool _isPublic = false;
  bool _saving = false;
  String? _imagePath;
  double? _venueLatitude;
  double? _venueLongitude;
  String? _venueAddress;
  List<Map<String, dynamic>> _apiEventTypes = [];
  bool _typesLoading = true;
  List<TicketClassData> _ticketClasses = [];

  // 5-step wizard: 0 Basic, 1 Date/Time, 2 Venue, 3 Tickets, 4 Preview
  int _step = 0;
  static const List<String> _stepTitles = ['Basic Info', 'Date & Time', 'Venue', 'Tickets', 'Preview'];

  bool get _isEdit => widget.editEvent != null;

  @override
  void initState() {
    super.initState();
    _loadEventTypes();
    if (_isEdit) {
      _populateFromEvent(widget.editEvent!);
      _loadExistingTicketClasses();
    } else {
      _checkAgreement();
    }
  }

  Future<void> _loadExistingTicketClasses() async {
    final eventId = widget.editEvent?['id']?.toString();
    if (eventId == null) return;
    final res = await TicketingService.getMyTicketClasses(eventId);
    if (res['success'] == true && mounted) {
      final classes = res['data']?['ticket_classes'] as List? ?? [];
      setState(() {
        _ticketClasses = classes
          .map((tc) => TicketClassData.fromJson(tc as Map<String, dynamic>))
          .toList();
      });
    }
  }

  void _populateFromEvent(Map<String, dynamic> e) {
    _titleCtrl.text = extractStr(e['title']);
    _descCtrl.text = extractStr(e['description']);
    _locationCtrl.text = extractStr(e['location']);
    _venueCtrl.text = extractStr(e['venue']);
    _dressCodeCtrl.text = extractStr(e['dress_code']);
    _specialInstructionsCtrl.text = extractStr(e['special_instructions']);
    _reminderContactPhoneCtrl.text = extractStr(e['reminder_contact_phone']);
    if (e['expected_guests'] != null) _expectedGuestsCtrl.text = AmountInputFormatter().formatEditUpdate(const TextEditingValue(), TextEditingValue(text: '${e['expected_guests']}')).text;
    if (e['budget'] != null) _budgetCtrl.text = AmountInputFormatter().formatEditUpdate(const TextEditingValue(), TextEditingValue(text: '${e['budget']}')).text;
    final rawType = e['event_type'];
    if (rawType is Map) {
      _eventTypeId = rawType['id']?.toString();
    } else if (rawType is String) {
      _eventTypeId = rawType;
    }
    _eventTypeId ??= e['event_type_id']?.toString();
    _visibility = extractStr(e['visibility'], fallback: 'private');
    _isPublic = e['is_public'] == true;
    _sellsTickets = e['sells_tickets'] == true;
    if (e['start_date'] != null) {
      try {
        _startDate = DateTime.parse(e['start_date'].toString());
        _startTime = TimeOfDay.fromDateTime(_startDate!);
      } catch (_) {}
    }
    if (e['end_date'] != null) {
      try { _endDate = DateTime.parse(e['end_date'].toString()); } catch (_) {}
    }
    final vc = e['venue_coordinates'];
    if (vc is Map) {
      _venueLatitude = double.tryParse(vc['latitude']?.toString() ?? '');
      _venueLongitude = double.tryParse(vc['longitude']?.toString() ?? '');
    }
    _venueAddress = e['venue_address']?.toString();
  }

  Future<void> _checkAgreement() async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    final accepted = await AgreementGate.checkAndPrompt(context, 'organiser_agreement');
    if (!accepted && mounted) Navigator.pop(context);
  }

  Future<void> _loadEventTypes() async {
    final res = await EventsService.getEventTypes();
    if (mounted) {
      setState(() {
        _typesLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          if (data is List) {
            _apiEventTypes = data.map((e) => e is Map<String, dynamic> ? e : <String, dynamic>{}).toList();
          }
        }
        if (_apiEventTypes.isEmpty) {
          _apiEventTypes = [
            {'id': 'wedding', 'name': 'Wedding'},
            {'id': 'birthday', 'name': 'Birthday'},
            {'id': 'corporate', 'name': 'Corporate'},
            {'id': 'graduation', 'name': 'Graduation'},
            {'id': 'funeral', 'name': 'Funeral'},
            {'id': 'baby_shower', 'name': 'Baby Shower'},
            {'id': 'anniversary', 'name': 'Anniversary'},
            {'id': 'conference', 'name': 'Conference'},
            {'id': 'other', 'name': 'Other'},
          ];
        }
        _eventTypeId ??= _apiEventTypes.first['id']?.toString();
      });
    }
  }

  Future<void> _openMapPicker() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => MapPickerScreen(
        initialLatitude: _venueLatitude,
        initialLongitude: _venueLongitude,
      )),
    );
    if (result != null && mounted) {
      setState(() {
        _venueLatitude = result['latitude'] as double?;
        _venueLongitude = result['longitude'] as double?;
        _venueAddress = result['address'] as String?;
        if (_locationCtrl.text.trim().isEmpty && _venueAddress != null) {
          _locationCtrl.text = _venueAddress!;
        }
      });
    }
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        imageQuality: 90,
      );
      if (picked == null || !mounted) return;

      // Crop to 16:9 cover ratio for parity with web cover image experience.
      final cropped = await ImageCropper().cropImage(
        sourcePath: picked.path,
        aspectRatio: const CropAspectRatio(ratioX: 16, ratioY: 9),
        compressQuality: 88,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop cover image',
            toolbarColor: const Color(0xFF1A1A2E),
            toolbarWidgetColor: Colors.white,
            activeControlsWidgetColor: AppColors.primary,
            backgroundColor: const Color(0xFF1A1A2E),
            dimmedLayerColor: Colors.black54,
            cropFrameColor: AppColors.primary,
            cropGridColor: Colors.white30,
            lockAspectRatio: true,
            hideBottomControls: false,
            showCropGrid: true,
            initAspectRatio: CropAspectRatioPreset.ratio16x9,
          ),
          IOSUiSettings(
            title: 'Crop cover image',
            aspectRatioLockEnabled: true,
            resetAspectRatioEnabled: false,
            minimumAspectRatio: 16 / 9,
          ),
        ],
      );
      if (cropped == null || !mounted) return;

      final size = await File(cropped.path).length();
      if (size > _maxCoverImageBytes) {
        if (mounted) {
          AppSnackbar.error(context, 'Cover image must be 5MB or smaller');
        }
        return;
      }

      setState(() => _imagePath = cropped.path);
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to pick image');
    }
  }

  bool _validateBeforeSave() {
    if ((_eventTypeId ?? '').isEmpty) {
      AppSnackbar.error(context, 'Please select an event type');
      return false;
    }

    if (_startDate == null) {
      AppSnackbar.error(context, 'Please select a start date');
      return false;
    }

    if (_endDate != null && _startDate != null) {
      final startOnly = DateTime(_startDate!.year, _startDate!.month, _startDate!.day);
      final endOnly = DateTime(_endDate!.year, _endDate!.month, _endDate!.day);
      if (endOnly.isBefore(startOnly)) {
        AppSnackbar.error(context, 'End date cannot be earlier than start date');
        return false;
      }
    }

    return true;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _venueCtrl.dispose();
    _expectedGuestsCtrl.dispose();
    _budgetCtrl.dispose();
    _dressCodeCtrl.dispose();
    _specialInstructionsCtrl.dispose();
    _reminderContactPhoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _save({bool asDraft = false}) async {
    if (!asDraft) {
      if (!_formKey.currentState!.validate()) return;
      if (!_validateBeforeSave()) return;
    }
    setState(() => _saving = true);

    final expectedGuests = int.tryParse(_expectedGuestsCtrl.text.replaceAll(RegExp(r'[^0-9]'), ''));
    final budget = double.tryParse(_budgetCtrl.text.replaceAll(RegExp(r'[^0-9.]'), ''));

    String? startDateStr;
    if (_startDate != null) {
      if (_startTime != null) {
        final combined = DateTime(_startDate!.year, _startDate!.month, _startDate!.day, _startTime!.hour, _startTime!.minute);
        startDateStr = combined.toIso8601String();
      } else {
        startDateStr = _startDate!.toIso8601String();
      }
    }

    String? timeStr;
    if (_startTime != null) {
      timeStr = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
    }

    Map<String, dynamic> res;
    if (_isEdit) {
      res = await EventsService.updateEvent(
        widget.editEvent!['id'].toString(),
        title: _titleCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        eventTypeId: _eventTypeId,
        location: _locationCtrl.text.trim(),
        venue: _venueCtrl.text.trim(),
        visibility: _visibility,
        startDate: startDateStr,
        endDate: _endDate?.toIso8601String(),
        expectedGuests: expectedGuests,
        budget: budget,
        sellsTickets: _sellsTickets,
        isPublic: _isPublic,
        dressCode: _dressCodeCtrl.text.trim().isEmpty ? null : _dressCodeCtrl.text.trim(),
        specialInstructions: _specialInstructionsCtrl.text.trim().isEmpty ? null : _specialInstructionsCtrl.text.trim(),
        reminderContactPhone: _reminderContactPhoneCtrl.text.trim().isEmpty ? null : _reminderContactPhoneCtrl.text.trim(),
        time: timeStr,
        imagePath: _imagePath,
        venueLatitude: _venueLatitude,
        venueLongitude: _venueLongitude,
        venueAddress: _venueAddress,
      );
    } else {
      res = await EventsService.createEvent(
        title: _titleCtrl.text.trim(),
        eventType: _eventTypeId ?? 'other',
        description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
        venue: _venueCtrl.text.trim().isEmpty ? null : _venueCtrl.text.trim(),
        visibility: _visibility,
        startDate: startDateStr,
        endDate: _endDate?.toIso8601String(),
        expectedGuests: expectedGuests,
        budget: budget,
        sellsTickets: _sellsTickets,
        isPublic: _isPublic,
        dressCode: _dressCodeCtrl.text.trim().isEmpty ? null : _dressCodeCtrl.text.trim(),
        specialInstructions: _specialInstructionsCtrl.text.trim().isEmpty ? null : _specialInstructionsCtrl.text.trim(),
        reminderContactPhone: _reminderContactPhoneCtrl.text.trim().isEmpty ? null : _reminderContactPhoneCtrl.text.trim(),
        time: timeStr,
        imagePath: _imagePath,
        venueLatitude: _venueLatitude,
        venueLongitude: _venueLongitude,
        venueAddress: _venueAddress,
      );
    }

    setState(() => _saving = false);
    if (mounted) {
      if (res['success'] == true) {
        final createdId = res['data']?['id']?.toString();
        if (_sellsTickets && createdId != null && _ticketClasses.isNotEmpty) {
          await _syncTicketClasses(createdId);
        }
        AppSnackbar.success(context, asDraft ? 'Draft saved' : (_isEdit ? 'Event updated' : 'Event created'));
        if (asDraft) {
          Navigator.pop(context, true);
        } else if (!_isEdit && res['data'] != null) {
          Navigator.pushReplacement(context, MaterialPageRoute(
            builder: (_) => EventDetailScreen(eventId: createdId!, initialData: res['data'], knownRole: 'creator'),
          ));
        } else {
          Navigator.pop(context, true);
        }
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Something went wrong. Please try again.');
      }
    }
  }

  Future<void> _syncTicketClasses(String eventId) async {
    for (final tc in _ticketClasses) {
      try {
        if (tc.id != null) {
          await TicketingService.updateTicketClass(tc.id!, tc.toJson());
        } else {
          await TicketingService.createTicketClass(eventId, tc.toJson());
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarContrastEnforced: false,
      ),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Column(children: [
            _buildHeader(),
            _buildStepper(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                child: Form(
                  key: _formKey,
                  child: _buildStepContent(),
                ),
              ),
            ),
            _buildStepNav(),
          ]),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 0:
        return Column(children: [
          _buildEventDetailsCard(),
          const SizedBox(height: 16),
          _buildCoverImageCard(),
          const SizedBox(height: 16),
          _buildVisibilityCard(),
        ]);
      case 1:
        return Column(children: [
          _buildDateTimeCard(),
          const SizedBox(height: 16),
          _buildGuestsBudgetCard(),
        ]);
      case 2:
        return Column(children: [
          _venueOnlyCard(),
          const SizedBox(height: 16),
          _buildOptionalDetailsCard(),
        ]);
      case 3:
        return Column(children: [
          EventTicketingCard(
            sellsTickets: _sellsTickets,
            onSellsTicketsChanged: (v) => setState(() => _sellsTickets = v),
            isPublic: _isPublic,
            onIsPublicChanged: (v) => setState(() => _isPublic = v),
            ticketClasses: _ticketClasses,
            onTicketClassesChanged: (v) => setState(() => _ticketClasses = v),
          ),
          const SizedBox(height: 16),
          EventRecommendationsCard(
            eventTypeId: _eventTypeId,
            eventTypeName: _apiEventTypes
                .firstWhere((t) => t['id']?.toString() == _eventTypeId, orElse: () => <String, dynamic>{})['name']
                ?.toString(),
            location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
            maxBudget: num.tryParse(_budgetCtrl.text.trim().replaceAll(RegExp(r'[^0-9.]'), '')),
          ),
          const SizedBox(height: 16),
          CardTemplatePicker(
            eventId: widget.editEvent?['id']?.toString(),
            eventTypeKey: _apiEventTypes
                .firstWhere((t) => t['id']?.toString() == _eventTypeId, orElse: () => <String, dynamic>{})['name']
                ?.toString()
                .toLowerCase(),
          ),
        ]);
      case 4:
      default:
        return _buildPreviewCard();
    }
  }

  Widget _venueOnlyCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('event_location')),
      _input(_locationCtrl, context.tr('event_venue_address')),
      const SizedBox(height: 12),
      _buildMapPickerButton(),
      const SizedBox(height: 16),
      _label(context.tr('venue_name')),
      _input(_venueCtrl, context.tr('venue_name_optional')),
    ]));
  }

  Widget _buildStepper() {
    const shortTitles = ['Basic', 'Date', 'Venue', 'Tickets', 'Preview'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: List.generate(_stepTitles.length * 2 - 1, (i) {
        if (i.isOdd) {
          final past = (i ~/ 2) < _step;
          return Expanded(child: Padding(
            padding: const EdgeInsets.only(top: 13),
            child: Container(height: 2, margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(color: past ? AppColors.primary : AppColors.border, borderRadius: BorderRadius.circular(2))),
          ));
        }
        final idx = i ~/ 2;
        final active = idx == _step;
        final done = idx < _step;
        return GestureDetector(
          onTap: () { if (idx < _step) setState(() => _step = idx); },
          behavior: HitTestBehavior.opaque,
          child: Column(children: [
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: active || done ? AppColors.primary : Colors.white,
                border: Border.all(color: active || done ? AppColors.primary : AppColors.border, width: 1.5),
              ),
              alignment: Alignment.center,
              child: done
                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                  : Text('${idx + 1}', style: appText(size: 12, weight: FontWeight.w700, color: active ? Colors.white : AppColors.textTertiary)),
            ),
            const SizedBox(height: 6),
            Text(shortTitles[idx], style: appText(size: 11, weight: active ? FontWeight.w700 : FontWeight.w500, color: active ? AppColors.textPrimary : AppColors.textTertiary)),
          ]),
        );
      })),
    );
  }

  Widget _buildStepNav() {
    final isLast = _step == _stepTitles.length - 1;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
        child: Row(children: [
          if (_step > 0) ...[
            SizedBox(
              height: 52, width: 52,
              child: OutlinedButton(
                onPressed: _saving ? null : () => setState(() => _step -= 1),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: SvgPicture.asset('assets/icons/arrow-left-icon.svg', width: 18, height: 18,
                  colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _saving
                    ? null
                    : () {
                        if (isLast) { _save(); return; }
                        if (!_validateStep(_step)) return;
                        setState(() => _step += 1);
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textPrimary))
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(isLast ? (_isEdit ? context.tr('save_changes') : context.tr('create_event')) : 'Next',
                              style: appText(size: 15, weight: FontWeight.w700, color: AppColors.textPrimary)),
                          const SizedBox(width: 8),
                          SvgPicture.asset('assets/icons/arrow-right-icon.svg', width: 18, height: 18,
                            colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                        ],
                      ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  bool _validateStep(int step) {
    switch (step) {
      case 0:
        if ((_eventTypeId ?? '').isEmpty) { AppSnackbar.error(context, 'Please select an event type'); return false; }
        if (_titleCtrl.text.trim().isEmpty) { AppSnackbar.error(context, 'Event title is required'); return false; }
        return true;
      case 1:
        if (_startDate == null) { AppSnackbar.error(context, 'Please select a start date'); return false; }
        if (_endDate != null && _endDate!.isBefore(_startDate!)) {
          AppSnackbar.error(context, 'End date cannot be earlier than start date'); return false;
        }
        return true;
      default:
        return true;
    }
  }

  Widget _buildPreviewCard() {
    final typeName = _apiEventTypes
        .firstWhere((t) => t['id']?.toString() == _eventTypeId, orElse: () => <String, dynamic>{})['name']
        ?.toString() ?? '';
    String dateLine = _startDate == null ? 'No date set' : _formatDate(_startDate!);
    if (_startTime != null) {
      dateLine += ' • ${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
    }
    return Column(children: [
      Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_imagePath != null)
            Image.file(File(_imagePath!), height: 200, width: double.infinity, fit: BoxFit.cover)
          else
            Container(
              height: 160, width: double.infinity,
              color: AppColors.surfaceVariant,
              child: Center(
                child: SvgPicture.asset('assets/icons/image-icon.svg', width: 36, height: 36,
                  colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (typeName.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.12), borderRadius: BorderRadius.circular(999)),
                  child: Text(typeName, style: appText(size: 11, weight: FontWeight.w700, color: AppColors.primary)),
                ),
              const SizedBox(height: 10),
              Text(_titleCtrl.text.trim().isEmpty ? 'Untitled event' : _titleCtrl.text.trim(),
                  style: appText(size: 22, weight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 14),
              _previewRow('assets/icons/calendar-icon.svg', dateLine),
              if (_locationCtrl.text.trim().isNotEmpty)
                _previewRow('assets/icons/location-icon.svg', _locationCtrl.text.trim()),
              if (_venueCtrl.text.trim().isNotEmpty)
                _previewRow('assets/icons/home-icon.svg', _venueCtrl.text.trim()),
              if (_expectedGuestsCtrl.text.trim().isNotEmpty)
                _previewRow('assets/icons/user-icon.svg', '${_expectedGuestsCtrl.text.trim()} expected guests'),
              if (_budgetCtrl.text.trim().isNotEmpty)
                _previewRow('assets/icons/card-icon.svg', 'Budget: ${_budgetCtrl.text.trim()}'),
              _previewRow(_visibility == 'public' ? 'assets/icons/view-icon.svg' : 'assets/icons/shield-icon.svg',
                  _visibility == 'public' ? 'Public event' : 'Private event'),
              if (_sellsTickets)
                _previewRow('assets/icons/ticket-icon.svg', '${_ticketClasses.length} ticket class${_ticketClasses.length == 1 ? '' : 'es'}'),
              if (_descCtrl.text.trim().isNotEmpty) ...[
                const SizedBox(height: 14),
                Text('About', style: appText(size: 12, weight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 0.6)),
                const SizedBox(height: 6),
                Text(_descCtrl.text.trim(), style: appText(size: 14, color: AppColors.textPrimary, height: 1.5)),
              ],
            ]),
          ),
        ]),
      ),
    ]);
  }

  Widget _previewRow(String iconAsset, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SvgPicture.asset(iconAsset, width: 16, height: 16,
          colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: appText(size: 14, color: AppColors.textPrimary, height: 1.4))),
      ]),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(children: [
        GestureDetector(
          onTap: () => Navigator.pop(context),
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.all(10),
            child: SvgPicture.asset('assets/icons/arrow-left-icon.svg', width: 22, height: 22,
              colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
          ),
        ),
        Expanded(child: Center(
          child: Text(
            _isEdit ? context.tr('edit_event') : context.tr('create_event'),
            style: appText(size: 17, weight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        )),
        GestureDetector(
          onTap: _saving ? null : _saveDraft,
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Text('Save Draft', style: appText(size: 14, weight: FontWeight.w600, color: AppColors.primary)),
          ),
        ),
      ]),
    );
  }

  Future<void> _saveDraft() async {
    if (_titleCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Add a title to save a draft');
      return;
    }
    if ((_eventTypeId ?? '').isEmpty) {
      AppSnackbar.error(context, 'Select an event type to save a draft');
      return;
    }
    await _save(asDraft: true);
  }

  Widget _buildEventDetailsCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('event_type')),
      _typesLoading
          ? const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
          : _eventTypeGrid(),
      const SizedBox(height: 16),
      _label(context.tr('event_title')),
      _input(_titleCtrl, context.tr('give_event_name'), validator: (v) => v == null || v.isEmpty ? context.tr('required_field') : v.length > 100 ? 'Max 100' : null),
      const SizedBox(height: 16),
      _label(context.tr('description')),
      _input(_descCtrl, context.tr('describe_event'), maxLines: 4),
    ]));
  }


  Widget _buildMapPickerButton() {
    return GestureDetector(
      onTap: _openMapPicker,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: _venueLatitude != null ? AppColors.primary.withOpacity(0.06) : const Color(0xFFF5F7FA),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _venueLatitude != null ? AppColors.primary.withOpacity(0.3) : AppColors.border),
        ),
        child: Row(children: [
          Icon(Icons.map_outlined, size: 18, color: _venueLatitude != null ? AppColors.primary : AppColors.textTertiary),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              _venueLatitude != null ? context.tr('location_pinned') : context.tr('pick_location'),
              style: appText(size: 14, color: _venueLatitude != null ? AppColors.primary : AppColors.textHint, weight: _venueLatitude != null ? FontWeight.w600 : FontWeight.w400),
            ),
            if (_venueAddress != null && _venueAddress!.isNotEmpty)
              Text(_venueAddress!, style: appText(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
          if (_venueLatitude != null)
            GestureDetector(
              onTap: () => setState(() { _venueLatitude = null; _venueLongitude = null; _venueAddress = null; }),
              child: const Icon(Icons.close, size: 16, color: AppColors.textTertiary),
            ),
        ]),
      ),
    );
  }

  Widget _buildDateTimeCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('date_and_time')),
      _datePicker(context.tr('start_date'), _startDate, (d) => setState(() => _startDate = d)),
      const SizedBox(height: 12),
      _timePicker(context.tr('start_time'), _startTime, (t) => setState(() => _startTime = t)),
      const SizedBox(height: 12),
      _datePicker(context.tr('end_date_optional'), _endDate, (d) => setState(() => _endDate = d)),
    ]));
  }

  Widget _buildGuestsBudgetCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('expected_guests')),
      _input(_expectedGuestsCtrl, 'e.g., 50', keyboardType: TextInputType.number, inputFormatters: amountFormatters),
      const SizedBox(height: 16),
      _label(context.tr('estimated_budget')),
      _input(_budgetCtrl, 'e.g., 5,000,000', keyboardType: TextInputType.number, inputFormatters: amountFormatters),
    ]));
  }

  Widget _buildCoverImageCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('cover_image')),
      GestureDetector(
        onTap: _pickImage,
        child: _imagePath != null
            ? ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Stack(children: [
                  Image.file(File(_imagePath!), width: double.infinity, height: 180, fit: BoxFit.cover),
                  Positioned(
                    top: 8, right: 8,
                    child: GestureDetector(
                      onTap: () => setState(() => _imagePath = null),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                        child: const Icon(Icons.close, size: 16, color: Colors.white),
                      ),
                    ),
                  ),
                ]),
              )
            : CustomPaint(
                painter: _DashedBorderPainter(color: AppColors.primary.withOpacity(0.55), radius: 14, dash: 6, gap: 4, strokeWidth: 1.4),
                child: Container(
                  width: double.infinity,
                  height: 150,
                  decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.04), borderRadius: BorderRadius.circular(14)),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.12), shape: BoxShape.circle),
                      child: const Icon(Icons.add_photo_alternate_outlined, size: 22, color: AppColors.primary),
                    ),
                    const SizedBox(height: 10),
                    Text(context.tr('tap_to_upload'), style: appText(size: 14, weight: FontWeight.w600, color: AppColors.textPrimary)),
                    const SizedBox(height: 2),
                    Text('PNG, JPG up to 5MB', style: appText(size: 11, color: AppColors.textTertiary)),
                  ]),
                ),
              ),
      ),
    ]));
  }

  Widget _buildVisibilityCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('visibility')),
      Row(children: ['private', 'public'].map((v) => Expanded(
        child: GestureDetector(
          onTap: () => setState(() {
            _visibility = v;
            _isPublic = v == 'public';
          }),
          child: Container(
            margin: EdgeInsets.only(right: v == 'private' ? 8 : 0, left: v == 'public' ? 8 : 0),
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: _visibility == v ? AppColors.primary.withOpacity(0.08) : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _visibility == v ? AppColors.primary : AppColors.border, width: _visibility == v ? 1.5 : 1),
            ),
            child: Center(child: Text(
              v[0].toUpperCase() + v.substring(1),
              style: appText(size: 14, weight: _visibility == v ? FontWeight.w700 : FontWeight.w500, color: _visibility == v ? AppColors.primary : AppColors.textSecondary),
            )),
          ),
        ),
      )).toList()),
    ]));
  }

  Widget _buildOptionalDetailsCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('additional_details')),
      _input(_dressCodeCtrl, context.tr('dress_code_hint')),
      const SizedBox(height: 12),
      _input(_specialInstructionsCtrl, context.tr('special_instructions_hint'), maxLines: 3),
      const SizedBox(height: 16),
      _label('Reminder contact phone (optional)'),
      _input(_reminderContactPhoneCtrl, 'e.g. +255712345678 — used in reminder messages instead of your number', keyboardType: TextInputType.phone),
    ]));
  }

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity, height: 54,
      child: ElevatedButton(
        onPressed: _saving ? null : _save,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: _saving
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(_isEdit ? context.tr('save_changes') : context.tr('create_event'), style: appText(size: 16, weight: FontWeight.w700, color: Colors.white)),
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
    width: double.infinity, padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border.withOpacity(0.5), width: 0.7)),
    child: child,
  );

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text, style: appText(size: 13, weight: FontWeight.w700, color: AppColors.textSecondary)),
  );

  Widget _input(TextEditingController ctrl, String hint, {String? Function(String?)? validator, int maxLines = 1, TextInputType? keyboardType, List<TextInputFormatter>? inputFormatters}) {
    return TextFormField(
      controller: ctrl, maxLines: maxLines, validator: validator, keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      style: appText(size: 15),
      decoration: InputDecoration(
        hintText: hint, hintStyle: appText(size: 14, color: AppColors.textHint),
        filled: true, fillColor: const Color(0xFFF5F7FA),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  Widget _eventTypeGrid() {
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: _apiEventTypes.map((t) {
        final id = t['id']?.toString() ?? '';
        final name = extractStr(t['name'], fallback: id);
        final selected = _eventTypeId == id;
        return GestureDetector(
          onTap: () => setState(() => _eventTypeId = id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: selected ? AppColors.primary.withOpacity(0.1) : const Color(0xFFF5F7FA),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
            ),
            child: Text(name, style: appText(size: 13, weight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? AppColors.primary : AppColors.textSecondary)),
          ),
        );
      }).toList(),
    );
  }

  Widget _toggleRow(String title, String subtitle, bool value, ValueChanged<bool> onChanged) {
    return Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: appText(size: 14, weight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(subtitle, style: appText(size: 11, color: AppColors.textTertiary)),
      ])),
      Switch.adaptive(value: value, onChanged: onChanged, activeColor: AppColors.primary),
    ]);
  }

  Widget _datePicker(String label, DateTime? value, ValueChanged<DateTime> onPick) {
    return GestureDetector(
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime.now().subtract(const Duration(days: 30)),
          lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
          builder: (ctx, child) => Theme(
            data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: Colors.white, surface: Colors.white)),
            child: child!,
          ),
        );
        if (date != null && mounted) onPick(date);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          SvgPicture.asset('assets/icons/calendar-icon.svg', width: 16, height: 16, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
          const SizedBox(width: 10),
          Expanded(child: Text(
            value != null ? _formatDate(value) : label,
            style: appText(size: 14, color: value != null ? AppColors.textPrimary : AppColors.textHint, weight: value != null ? FontWeight.w500 : FontWeight.w400),
          )),
        ]),
      ),
    );
  }

  Widget _timePicker(String label, TimeOfDay? value, ValueChanged<TimeOfDay> onPick) {
    return GestureDetector(
      onTap: () async {
        final time = await showTimePicker(
          context: context,
          initialTime: value ?? TimeOfDay.now(),
          initialEntryMode: TimePickerEntryMode.input,
          builder: (ctx, child) => Theme(
            data: Theme.of(ctx).copyWith(
              colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: Colors.white, surface: Colors.white),
              timePickerTheme: TimePickerThemeData(
                backgroundColor: Colors.white,
                hourMinuteShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                dayPeriodShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
            ),
            child: MediaQuery(data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true), child: child!),
          ),
        );
        if (time != null && mounted) onPick(time);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          SvgPicture.asset('assets/icons/clock-icon.svg', width: 16, height: 16, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
          const SizedBox(width: 10),
          Expanded(child: Text(
            value != null ? value.format(context) : label,
            style: appText(size: 14, color: value != null ? AppColors.textPrimary : AppColors.textHint, weight: value != null ? FontWeight.w500 : FontWeight.w400),
          )),
        ]),
      ),
    );
  }

  String _formatDate(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;
  final double dash;
  final double gap;
  final double strokeWidth;
  _DashedBorderPainter({required this.color, required this.radius, required this.dash, required this.gap, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius));
    final path = Path()..addRRect(rrect);
    for (final m in path.computeMetrics()) {
      double dist = 0;
      while (dist < m.length) {
        final next = (dist + dash).clamp(0, m.length).toDouble();
        canvas.drawPath(m.extractPath(dist, next), paint);
        dist = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter old) =>
      old.color != color || old.radius != radius || old.dash != dash || old.gap != gap || old.strokeWidth != strokeWidth;
}
