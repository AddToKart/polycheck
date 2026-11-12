import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_toast.dart';

/// One-shot geofence picker: tap or drag the pin, adjust the radius, or snap to
/// the current GPS fix. Defaults to PUP Santa Maria, Bulacan
/// (`frontend/src/components/MapPicker.tsx` parity).
class GeofenceMapPicker extends StatefulWidget {
  const GeofenceMapPicker({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.onChanged,
    required this.onRadiusChanged,
    this.height = 240,
  });

  final double latitude;
  final double longitude;
  final double radiusMeters;
  final void Function(double latitude, double longitude) onChanged;
  final ValueChanged<double> onRadiusChanged;
  final double height;

  @override
  State<GeofenceMapPicker> createState() => _GeofenceMapPickerState();
}

class _GeofenceMapPickerState extends State<GeofenceMapPicker> {
  final MapController _controller = MapController();
  bool _locating = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _useMyLocation() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw const _LocationIssue('Turn on location services and try again.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw const _LocationIssue(
          'Location permission is required to centre the geofence.',
        );
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      if (!mounted) return;
      widget.onChanged(position.latitude, position.longitude);
      _controller.move(LatLng(position.latitude, position.longitude), 17.5);
      CampusToast.showIn(
        context,
        'Geofence centred on the current fix (±${position.accuracy.round()}m).',
      );
    } on _LocationIssue catch (issue) {
      if (mounted) {
        CampusToast.showIn(
          context,
          issue.message,
          tone: CampusToastTone.warning,
        );
      }
    } catch (error) {
      if (mounted) {
        CampusToast.showIn(
          context,
          'Unable to read the current location: $error',
          tone: CampusToastTone.error,
        );
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final center = LatLng(widget.latitude, widget.longitude);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: widget.height,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: FlutterMap(
              mapController: _controller,
              options: MapOptions(
                initialCenter: center,
                initialZoom: 17,
                minZoom: 12,
                maxZoom: 20,
                onTap: (tapPosition, point) =>
                    widget.onChanged(point.latitude, point.longitude),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'edu.pup.polycheck',
                ),
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: center,
                      radius: widget.radiusMeters,
                      useRadiusInMeter: true,
                      color: tokens.maroon.withValues(alpha: 0.12),
                      borderColor: tokens.maroon,
                      borderStrokeWidth: 2,
                    ),
                  ],
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: center,
                      width: 48,
                      height: 48,
                      child: Builder(
                        builder: (markerContext) => GestureDetector(
                          onPanUpdate: (details) {
                            final camera = MapCamera.maybeOf(markerContext);
                            if (camera == null) return;
                            final offset = camera.latLngToScreenOffset(
                              LatLng(widget.latitude, widget.longitude),
                            );
                            final next = camera.screenOffsetToLatLng(
                              offset + details.delta,
                            );
                            widget.onChanged(next.latitude, next.longitude);
                          },
                          child: Tooltip(
                            message: 'Drag to move the geofence centre',
                            child: Icon(
                              Icons.location_on,
                              size: 44,
                              color: tokens.isDark
                                  ? tokens.gold
                                  : tokens.maroon,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                RichAttributionWidget(
                  attributions: [
                    TextSourceAttribution(
                      'OpenStreetMap contributors',
                      onTap: () {},
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                'Radius: ${widget.radiusMeters.round()} m',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            TextButton.icon(
              onPressed: _locating ? null : _useMyLocation,
              icon: _locating
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location, size: 16),
              label: const Text('Use my location'),
            ),
          ],
        ),
        Slider(
          value: widget.radiusMeters.clamp(10.0, 500.0).toDouble(),
          min: 10,
          max: 500,
          divisions: 49,
          label: '${widget.radiusMeters.round()} m',
          onChanged: widget.onRadiusChanged,
        ),
        Text(
          'Tap the map or drag the pin. The 30–50 m classroom radius is '
          'typical; 10–500 m is allowed.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
      ],
    );
  }
}

class _LocationIssue implements Exception {
  const _LocationIssue(this.message);

  final String message;
}
