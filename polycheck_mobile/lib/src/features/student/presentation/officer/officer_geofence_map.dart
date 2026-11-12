import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Small geofence composer: tap to place, drag the pin, radius circle drawn in
/// meters. Map interaction is disabled while the pin is being dragged so the
/// marker moves instead of the map.
class OfficerGeofenceMap extends StatefulWidget {
  const OfficerGeofenceMap({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.onChanged,
  });

  final double latitude;
  final double longitude;
  final double radiusMeters;
  final void Function(double latitude, double longitude) onChanged;

  @override
  State<OfficerGeofenceMap> createState() => _OfficerGeofenceMapState();
}

class _OfficerGeofenceMapState extends State<OfficerGeofenceMap> {
  bool _dragging = false;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final point = LatLng(widget.latitude, widget.longitude);
    return SizedBox(
      height: 220,
      child: FlutterMap(
        options: MapOptions(
          initialCenter: point,
          initialZoom: 17,
          interactionOptions: InteractionOptions(
            flags: _dragging ? InteractiveFlag.none : InteractiveFlag.all,
          ),
          onTap: (_, tapped) =>
              widget.onChanged(tapped.latitude, tapped.longitude),
        ),
        children: <Widget>[
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'edu.pup.polycheck',
          ),
          CircleLayer(
            circles: <CircleMarker>[
              CircleMarker(
                point: point,
                radius: widget.radiusMeters,
                useRadiusInMeter: true,
                color: PupColors.pupMaroon.withValues(alpha: 0.12),
                borderColor: tokens.maroon,
                borderStrokeWidth: 2,
              ),
            ],
          ),
          MarkerLayer(
            markers: <Marker>[
              Marker(
                point: point,
                width: 46,
                height: 46,
                alignment: Alignment.topCenter,
                child: Builder(
                  builder: (markerContext) {
                    final camera = MapCamera.of(markerContext);
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onPanStart: (_) => setState(() => _dragging = true),
                      onPanUpdate: (details) {
                        final next = camera.screenOffsetToLatLng(
                          camera.latLngToScreenOffset(point) + details.delta,
                        );
                        widget.onChanged(next.latitude, next.longitude);
                      },
                      onPanEnd: (_) => setState(() => _dragging = false),
                      child: Icon(
                        Icons.location_on,
                        size: 40,
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                        semanticLabel: 'Geofence center pin',
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
