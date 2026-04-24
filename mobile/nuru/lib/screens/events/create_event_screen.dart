
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
    if (e['expected_guests'] != null) _expectedGuestsCtrl.text = '${e['expected_guests']}';
    if (e['budget'] != null) _budgetCtrl.text = '${e['budget']}';
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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_validateBeforeSave()) return;
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
        AppSnackbar.success(context, _isEdit ? 'Event updated' : 'Event created');
        if (!_isEdit && res['data'] != null) {
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
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: Column(children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(children: [
                    _buildEventDetailsCard(),
                    const SizedBox(height: 16),
                    _buildDateTimeCard(),
                    const SizedBox(height: 16),
                    _buildGuestsBudgetCard(),
                    const SizedBox(height: 16),
                    _buildCoverImageCard(),
                    const SizedBox(height: 16),
                    _buildVisibilityCard(),
                    const SizedBox(height: 16),
                    EventTicketingCard(
                      sellsTickets: _sellsTickets,
                      onSellsTicketsChanged: (v) => setState(() => _sellsTickets = v),
                      isPublic: _isPublic,
                      onIsPublicChanged: (v) => setState(() => _isPublic = v),
                      ticketClasses: _ticketClasses,
                      onTicketClassesChanged: (v) => setState(() => _ticketClasses = v),
                    ),
                    const SizedBox(height: 16),
                    _buildOptionalDetailsCard(),
                    const SizedBox(height: 16),
                    EventRecommendationsCard(
                      eventTypeId: _eventTypeId,
                      eventTypeName: _apiEventTypes
                          .firstWhere(
                            (t) => t['id']?.toString() == _eventTypeId,
                            orElse: () => <String, dynamic>{},
                          )['name']
                          ?.toString(),
                      location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
                      maxBudget: num.tryParse(_budgetCtrl.text.trim().replaceAll(RegExp(r'[^0-9.]'), '')),
                    ),
                    const SizedBox(height: 16),
                    CardTemplatePicker(
                      eventId: widget.editEvent?['id']?.toString(),
                      eventTypeKey: _apiEventTypes
                          .firstWhere(
                            (t) => t['id']?.toString() == _eventTypeId,
                            orElse: () => <String, dynamic>{},
                          )['name']
                          ?.toString()
                          .toLowerCase(),
                    ),
                    const SizedBox(height: 28),
                    _buildSaveButton(),
                    const SizedBox(height: 40),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(children: [
        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.7), borderRadius: BorderRadius.circular(12)),
            child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 20, height: 20,
              colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(child: Text(_isEdit ? context.tr('edit_event') : context.tr('create_event'), style: appText(size: 18, weight: FontWeight.w700))),
      ]),
    );
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
      _label(context.tr('event_location')),
      _input(_locationCtrl, context.tr('event_venue_address')),
      const SizedBox(height: 12),
      _buildMapPickerButton(),
      const SizedBox(height: 16),
      _label(context.tr('venue_name')),
      _input(_venueCtrl, context.tr('venue_name_optional')),
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
      _input(_expectedGuestsCtrl, 'e.g., 50', keyboardType: TextInputType.number),
      const SizedBox(height: 16),
      _label(context.tr('estimated_budget')),
      _input(_budgetCtrl, 'e.g., 5,000,000', keyboardType: TextInputType.number),
    ]));
  }

  Widget _buildCoverImageCard() {
    return _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _label(context.tr('cover_image')),
      GestureDetector(
        onTap: _pickImage,
        child: Container(
          width: double.infinity,
          height: _imagePath != null ? 180 : 120,
          decoration: BoxDecoration(
            color: const Color(0xFFF5F7FA),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
            image: _imagePath != null ? DecorationImage(image: FileImage(File(_imagePath!)), fit: BoxFit.cover) : null,
          ),
          child: _imagePath == null
              ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.cloud_upload_outlined, size: 32, color: AppColors.textHint),
                  const SizedBox(height: 8),
                  Text(context.tr('tap_to_upload'), style: appText(size: 13, color: AppColors.textHint)),
                  Text('PNG, JPG (max 5MB)', style: appText(size: 11, color: AppColors.textHint)),
                ])
              : Align(
                  alignment: Alignment.topRight,
                  child: GestureDetector(
                    onTap: () => setState(() => _imagePath = null),
                    child: Container(
                      margin: const EdgeInsets.all(8),
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                      child: const Icon(Icons.close, size: 16, color: Colors.white),
                    ),
                  ),
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

  Widget _input(TextEditingController ctrl, String hint, {String? Function(String?)? validator, int maxLines = 1, TextInputType? keyboardType}) {
    return TextFormField(
      controller: ctrl, maxLines: maxLines, validator: validator, keyboardType: keyboardType,
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
            child: MediaQuery(data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: false), child: child!),
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
