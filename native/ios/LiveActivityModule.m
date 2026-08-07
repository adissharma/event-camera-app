#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(startActivity:(NSString *)eventName
                  celebrationId:(NSString *)celebrationId
                  photosLeft:(NSInteger)photosLeft
                  endTimeMs:(double)endTimeMs)

RCT_EXTERN_METHOD(updateActivity:(NSString *)celebrationId
                  photosLeft:(NSInteger)photosLeft
                  endTimeMs:(double)endTimeMs)

RCT_EXTERN_METHOD(endActivity:(NSString *)celebrationId)

RCT_EXTERN_METHOD(endAllActivities)

@end
