import httpx
import asyncio

async def test_api():
    try:
        # Step 1: Login to get token
        async with httpx.AsyncClient() as client:
            login_res = await client.post("http://127.0.0.1:8000/auth/login", data={"username": "jonsnowjonny15@gmail.com", "password": "password"})
            if login_res.status_code != 200:
                print("Failed login:", login_res.json())
                return
            token = login_res.json()["access_token"]
            
            # Step 2: Try selling
            headers = {"Authorization": f"Bearer {token}"}
            
            # Find a crop
            crops_res = await client.get("http://127.0.0.1:8000/farmer/crops/", headers=headers)
            if crops_res.status_code != 200 or not crops_res.json():
                print("No crops found:", crops_res.text)
                return
            crop_id = crops_res.json()[0]["id"]
            
            payload = {
                "buyer_type": "Mill",
                "buyer_name": "API Test",
                "buyer_id": "",
                "price_per_quintal": 2000,
                "quantity_quintals": 10,
                "total_bags": 20,
                "bag_size": 50,
                "payment_mode": "Cash",
                "notes": "",
                "total_revenue": 20000,
                "date": "2026-04-09T00:00:00.000Z",
                "status": "listed",
                "harvest_ids": []
            }
            
            sale_res = await client.post(f"http://127.0.0.1:8000/farmer/crops/{crop_id}/sales", json=payload, headers=headers)
            print(f"Status: {sale_res.status_code}")
            try:
                print("Response:", sale_res.json())
            except:
                print("Text:", sale_res.text)
                
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_api())
