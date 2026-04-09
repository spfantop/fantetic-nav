import { useEffect, useState } from "react";
import { fetchAdminData } from "../../../utils/api";

export const useData = () => {
  const [store, setState] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const data = await fetchAdminData();
    setState(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [])

  return {
    store,
    loading,
    reload: fetchData,
  }
}
